// Lets the page save files in this project folder, which a browser page
// cannot do on its own. It runs inside the Vite dev server (see
// vite.config.js) and answers these requests:
//
// Spells: one JSON file each in public/library/spells/, listed in its
// index.json. They are part of the repository, so a spell you make or edit
// is committed with your next push.
//   GET    /api/spells              every spell, each with its `file` name
//   POST   /api/spells              create a spell (JSON body) → { file }
//   PUT    /api/spells/<file>       save a spell
//   DELETE /api/spells/<file>       delete a spell
//
// Recordings: in recordings/<id>/, which git ignores (they stay on this
// computer). Each has video.mp4 or video.webm (camera and microphone; MP4
// when the browser can record it), meta.json (name,
// length, the spells cast and when) and track.json (the hand positions in
// every frame).
//   GET    /api/recordings                  every recording's meta.json
//   PUT    /api/recordings/<id>/video?ext=mp4|webm   save the video (raw bytes)
//   PUT    /api/recordings/<id>/meta        save meta.json
//   PUT    /api/recordings/<id>/track       save track.json
//   GET    /api/recordings/<id>/video       the video (supports seeking)
//   GET    /api/recordings/<id>/track       track.json
//   DELETE /api/recordings/<id>             delete the recording
//
// Exports: finished videos from the Finalize tab, in exports/ (git-ignored).
//   PUT    /api/exports/<name>.mp4|.webm    save a finished video → { path }
//
// Library: every animation and sound is an entry in
// public/library/animations/index.json or public/library/audio/index.json.
// Uploaded ones are files in the same folder; the ones made by code (coins,
// fireball, the built-in sounds…) have a `procedural` name instead of a file.
// All of it is part of the repository, so spells that use them work wherever
// the project is cloned. (<kind> is animations or audio.)
//   POST   /api/library/<kind>?name=&id=    save an uploaded file (raw bytes) → its index entry
//   PUT    /api/library/<kind>/<id>         change an entry (name, description, and for an
//                                            animation file its placement on the hand)
//   DELETE /api/library/<kind>/<id>         delete an entry (and its file, if it has one)
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { cleanPlacement } from '../src/library/placement.js'

const root = new URL('../', import.meta.url)
const SPELLS = new URL('public/library/spells/', root)
const SPELL_INDEX = new URL('index.json', SPELLS)
const RECORDINGS = new URL('recordings/', root)
const EXPORTS = new URL('exports/', root)
const MAX_JSON_BYTES = 50_000_000

// File and folder names are checked so a request can't reach outside these folders.
const SPELL_FILE = /^[a-z0-9][a-z0-9-]*\.json$/
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/
const EXPORT_FILE = /^[a-z0-9][a-z0-9-]*\.(mp4|webm)$/
const VIDEO_TYPES = { mp4: 'video/mp4', webm: 'video/webm' }

// The same formats the app accepts (src/library/formats.js).
const LIBRARY_EXTENSIONS = {
  animations: ['webm', 'mp4', 'gif', 'webp', 'png', 'apng', 'json'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'webm'],
}
const LIBRARY_FILE = /^[a-z0-9][a-z0-9._-]*$/
// Content types for serving library files (see serveLibraryFile).
const LIBRARY_TYPES = {
  webm: 'video/webm', mp4: 'video/mp4', gif: 'image/gif', webp: 'image/webp', png: 'image/png', apng: 'image/apng', json: 'application/json',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
}
const LIBRARY_ID = /^[A-Za-z0-9:._-]{1,100}$/

// A recording's video file, whichever format it was saved in.
async function findVideo(folder) {
  for (const ext of Object.keys(VIDEO_TYPES)) {
    const url = new URL(`video.${ext}`, folder)
    if (await stat(url).then(() => true, () => false)) return { url, type: VIDEO_TYPES[ext] }
  }
  return null
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'))
  } catch {
    return fallback
  }
}

async function bodyText(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_JSON_BYTES) throw new Error('Request is too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function bodyJson(request) {
  return JSON.parse(await bodyText(request))
}

function send(response, status, body) {
  response.statusCode = status
  if (body === undefined) return response.end()
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

function slug(text) {
  const base = String(text || 'spell')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'spell'
}

// ---------- spells ----------

async function listSpells() {
  const files = await readJson(SPELL_INDEX, [])
  const spells = []
  for (const file of files) {
    const spell = await readJson(new URL(file, SPELLS), null)
    if (spell) spells.push({ ...spell, file })
  }
  return spells
}

function stripRuntime(spell) {
  // eslint-disable-next-line no-unused-vars
  const { file, builtIn, ...rest } = spell
  return rest
}

async function createSpell(spell) {
  const files = await readJson(SPELL_INDEX, [])
  let file
  do {
    file = `${slug(spell.name)}-${Math.random().toString(36).slice(2, 6)}.json`
  } while (files.includes(file))
  await writeFile(new URL(file, SPELLS), JSON.stringify(stripRuntime(spell)) + '\n')
  await writeFile(SPELL_INDEX, JSON.stringify([...files, file], null, 2) + '\n')
  return file
}

async function saveSpell(file, spell) {
  const files = await readJson(SPELL_INDEX, [])
  if (!files.includes(file)) throw Object.assign(new Error('No such spell'), { status: 404 })
  await writeFile(new URL(file, SPELLS), JSON.stringify(stripRuntime(spell)) + '\n')
}

async function deleteSpell(file) {
  const files = await readJson(SPELL_INDEX, [])
  await writeFile(SPELL_INDEX, JSON.stringify(files.filter((f) => f !== file), null, 2) + '\n')
  await unlink(new URL(file, SPELLS)).catch(() => {})
}

// ---------- recordings ----------

async function listRecordings() {
  await mkdir(RECORDINGS, { recursive: true })
  const metas = []
  for (const entry of await readdir(RECORDINGS, { withFileTypes: true })) {
    if (!entry.isDirectory() || !SAFE_ID.test(entry.name)) continue
    const meta = await readJson(new URL(`${entry.name}/meta.json`, RECORDINGS), null)
    if (meta) metas.push(meta)
  }
  return metas.sort((a, b) => a.createdAt - b.createdAt)
}

async function saveStream(request, url) {
  await mkdir(new URL('./', url), { recursive: true })
  await pipeline(request, createWriteStream(url))
}

// Sends a file, honouring "Range" requests so the video player can seek.
async function sendFile(request, response, url, type) {
  const { size } = await stat(url)
  response.setHeader('Content-Type', type)
  response.setHeader('Accept-Ranges', 'bytes')
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '')
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2])
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      response.statusCode = 416
      response.setHeader('Content-Range', `bytes */${size}`)
      return response.end()
    }
    response.statusCode = 206
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    response.setHeader('Content-Length', end - start + 1)
    return pipeline(createReadStream(url, { start, end }), response)
  }
  response.setHeader('Content-Length', size)
  return pipeline(createReadStream(url), response)
}

// ---------- library files ----------

const libraryFolder = (kind) => new URL(`public/library/${kind}/`, root)

async function readLibraryIndex(kind) {
  return readJson(new URL('index.json', libraryFolder(kind)), [])
}

async function writeLibraryIndex(kind, entries) {
  await writeFile(new URL('index.json', libraryFolder(kind)), JSON.stringify(entries, null, 2) + '\n')
}

// A safe file name from an uploaded name: "My Sound (1).MP3" → my-sound-1.mp3,
// with a short random part added if that name is taken.
function libraryFileName(original, kind, taken) {
  const dot = original.lastIndexOf('.')
  const ext = dot === -1 ? '' : original.slice(dot + 1).toLowerCase()
  if (!LIBRARY_EXTENSIONS[kind].includes(ext)) throw Object.assign(new Error(`Not a supported ${kind} format`), { status: 400 })
  const base = slug(dot === -1 ? original : original.slice(0, dot))
  let name = `${base}.${ext}`
  while (taken.has(name)) name = `${base}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  return name
}

async function addLibraryFile(request, kind, original, id) {
  const entries = await readLibraryIndex(kind)
  const file = libraryFileName(original, kind, new Set(entries.map((e) => e.file)))
  const url = new URL(file, libraryFolder(kind))
  await saveStream(request, url)
  const entry = {
    id: id && LIBRARY_ID.test(id) ? id : `file:${kind}:${file}`,
    name: original,
    file,
    description: '',
    size: (await stat(url)).size,
    addedAt: Date.now(),
  }
  await writeLibraryIndex(kind, [...entries, entry])
  return entry
}

// Entries are found by id: animations and sounds made by code have no file.
async function updateLibraryEntry(kind, id, changes) {
  const entries = await readLibraryIndex(kind)
  const at = entries.findIndex((e) => e.id === id)
  if (at === -1) throw Object.assign(new Error('No such item'), { status: 404 })
  const allowed = {}
  if (typeof changes.name === 'string') allowed.name = changes.name
  if (typeof changes.description === 'string') allowed.description = changes.description
  if (kind === 'animations' && changes.placement) allowed.placement = cleanPlacement(changes.placement)
  entries[at] = { ...entries[at], ...allowed }
  await writeLibraryIndex(kind, entries)
}

// Removes the entry, and its file if it has one (made-by-code items don't).
async function deleteLibraryEntry(kind, id) {
  const entries = await readLibraryIndex(kind)
  const entry = entries.find((e) => e.id === id)
  if (!entry) return
  await writeLibraryIndex(kind, entries.filter((e) => e !== entry))
  if (entry.file && LIBRARY_FILE.test(entry.file) && entry.file !== 'index.json') {
    await unlink(new URL(entry.file, libraryFolder(kind))).catch(() => {})
  }
}

// ---------- routing ----------

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean) // after /api
  const method = request.method
  try {
    if (parts[0] === 'spells') {
      const file = parts[1]
      if (!file && method === 'GET') return send(response, 200, await listSpells())
      if (!file && method === 'POST') return send(response, 201, { file: await createSpell(await bodyJson(request)) })
      if (file && !SPELL_FILE.test(file)) return send(response, 400, { error: 'Bad spell file name' })
      if (file && method === 'PUT') return send(response, 204, await saveSpell(file, await bodyJson(request)))
      if (file && method === 'DELETE') return send(response, 204, await deleteSpell(file))
    }
    if (parts[0] === 'recordings') {
      const [, id, part] = parts
      if (!id && method === 'GET') return send(response, 200, await listRecordings())
      if (!id || !SAFE_ID.test(id)) return send(response, 400, { error: 'Bad recording id' })
      const folder = new URL(`${id}/`, RECORDINGS)
      if (method === 'DELETE' && !part) {
        await rm(folder, { recursive: true, force: true })
        return send(response, 204)
      }
      if (part === 'video' && method === 'PUT') {
        const ext = url.searchParams.get('ext') === 'mp4' ? 'mp4' : 'webm'
        return send(response, 204, await saveStream(request, new URL(`video.${ext}`, folder)))
      }
      if (part === 'video' && method === 'GET') {
        const video = await findVideo(folder)
        if (!video) return send(response, 404, { error: 'No video' })
        return await sendFile(request, response, video.url, video.type)
      }
      if ((part === 'meta' || part === 'track') && method === 'PUT') {
        const data = await bodyJson(request)
        await mkdir(folder, { recursive: true })
        await writeFile(new URL(`${part}.json`, folder), JSON.stringify(data))
        return send(response, 204)
      }
      if (part === 'track' && method === 'GET') return send(response, 200, await readJson(new URL('track.json', folder), []))
    }
    if (parts[0] === 'library') {
      const [, kind, rawId] = parts
      if (!LIBRARY_EXTENSIONS[kind]) return send(response, 400, { error: 'Bad library kind' })
      if (!rawId && method === 'POST') {
        const name = url.searchParams.get('name') ?? ''
        return send(response, 201, await addLibraryFile(request, kind, name, url.searchParams.get('id')))
      }
      const id = rawId ? decodeURIComponent(rawId) : ''
      if (!LIBRARY_ID.test(id)) return send(response, 400, { error: 'Bad item id' })
      if (method === 'PUT') return send(response, 204, await updateLibraryEntry(kind, id, await bodyJson(request)))
      if (method === 'DELETE') return send(response, 204, await deleteLibraryEntry(kind, id))
    }
    if (parts[0] === 'exports' && method === 'PUT') {
      const name = parts[1]
      if (!name || !EXPORT_FILE.test(name)) return send(response, 400, { error: 'Bad export name' })
      const target = new URL(name, EXPORTS)
      await saveStream(request, target)
      return send(response, 201, { path: fileURLToPath(target) })
    }
    send(response, 404, { error: 'Not found' })
  } catch (error) {
    if (!response.headersSent) send(response, error.status ?? 500, { error: error.message })
    else response.destroy(error)
  }
}

// Serves an imported animation or sound straight from public/library/<kind>/.
// Vite serves public/ itself, but only files it knew of at start-up or saw
// through its file watcher, and the watcher ignores public/library (so saving
// there doesn't reload the page). Without this, a file imported after the dev
// server started isn't served until it restarts.
async function serveLibraryFile(request, response, next) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next()
  const [kind, name, extra] = decodeURIComponent((request.url ?? '').split('?')[0]).split('/').filter(Boolean)
  const extension = name?.split('.').pop().toLowerCase()
  if (extra || !LIBRARY_EXTENSIONS[kind] || !name || !LIBRARY_FILE.test(name) || !LIBRARY_EXTENSIONS[kind].includes(extension)) return next()
  const url = new URL(name, libraryFolder(kind))
  if (!(await stat(url).then(() => true, () => false))) return next()
  response.setHeader('Cache-Control', 'no-cache')
  try {
    await sendFile(request, response, url, LIBRARY_TYPES[extension] ?? 'application/octet-stream')
  } catch (error) {
    if (!response.headersSent) send(response, 500, { error: error.message })
  }
}

export function projectStorage() {
  return {
    name: 'project-storage',
    configureServer(server) {
      server.middlewares.use('/api', handle)
      server.middlewares.use('/library', serveLibraryFile)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', handle)
    },
  }
}
