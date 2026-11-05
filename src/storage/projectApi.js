// Talks to the dev server's file storage (server/storage.js): spells saved
// into the repository, and recordings and exports saved locally.

async function request(method, path, body, headers = {}) {
  const response = await fetch(`/api/${path}`, { method, body, headers })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error ?? `${method} ${path} failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

const json = (value) => [JSON.stringify(value), { 'Content-Type': 'application/json' }]

// Pending saves per file, so saves to one file happen in order (see below).
const queues = new Map()

// ---------- spells ----------

export const listSpells = () => request('GET', 'spells')
export const createSpellFile = (spell) => request('POST', 'spells', ...json(spell)).then((result) => result.file)
export const deleteSpellFile = (file) => request('DELETE', `spells/${file}`)

// Saves to the same file one after another, in order, so quick edits (typing
// a name) can't overtake each other and leave an older version on disk.
export function saveSpellFile(file, spell) {
  const previous = queues.get(file) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => request('PUT', `spells/${file}`, ...json(spell)))
  queues.set(file, next)
  return next
}

// ---------- recordings ----------

export const listRecordings = () => request('GET', 'recordings')
export const recordingVideoUrl = (id) => `/api/recordings/${id}/video`
export const loadTrack = (id) => request('GET', `recordings/${id}/track`)
export function saveRecordingMeta(id, meta) {
  const key = `recordings/${id}`
  const previous = queues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => request('PUT', `recordings/${id}/meta`, ...json(meta)))
  queues.set(key, next)
  return next
}
export const deleteRecordingFiles = (id) => request('DELETE', `recordings/${id}`)

export async function saveRecordingFiles({ id, blob, ext, meta, track }) {
  await request('PUT', `recordings/${id}/video?ext=${ext}`, blob, { 'Content-Type': blob.type || 'application/octet-stream' })
  await request('PUT', `recordings/${id}/track`, ...json(track))
  await saveRecordingMeta(id, meta)
}

// ---------- exports ----------

// Returns the path the file was saved to.
export async function saveExportFile(name, blob) {
  const result = await request('PUT', `exports/${name}`, blob, { 'Content-Type': blob.type || 'application/octet-stream' })
  return result.path
}

// ---------- library files (uploaded animations and sounds) ----------

// kind: 'animations' | 'audio'. Returns the file's index entry.
export function uploadLibraryFile(kind, file, id) {
  const query = new URLSearchParams({ name: file.name, ...(id && { id }) })
  return request('POST', `library/${kind}?${query}`, file, { 'Content-Type': file.type || 'application/octet-stream' })
}
// Entries are found by id (sounds and animations made by code have no file).
export function updateLibraryEntry(kind, id, changes) {
  const key = `library/${kind}/${id}`
  const previous = queues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => request('PUT', `library/${kind}/${encodeURIComponent(id)}`, ...json(changes)))
  queues.set(key, next)
  return next
}
export const deleteLibraryEntry = (kind, id) => request('DELETE', `library/${kind}/${encodeURIComponent(id)}`)
