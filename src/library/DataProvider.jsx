import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAll, put, remove, requestPersistentStorage } from '../storage/db.js'
import { PROCEDURAL, loadBuiltInSpells, loadFileManifest } from './builtins.js'
import {
  createSpellFile,
  deleteRecordingFiles,
  deleteSpellFile,
  listRecordings,
  listSpells,
  saveRecordingFiles,
  saveRecordingMeta,
  saveSpellFile,
} from '../storage/projectApi.js'
import { isAccepted } from './formats.js'
import { DataContext } from './DataContext.js'

// Loads everything once when the app starts and keeps it in React state.
// Changes are saved straight away, so they survive a reload:
//   spells      as files in public/library/spells/ (part of the repository)
//   recordings  as files in recordings/ (local only, git-ignored)
//   uploads     in the browser's IndexedDB
// Spells and recordings are written by the dev server (server/storage.js).
// Without it (a static build) spells are read-only and there are no
// recordings.
//
// An uploaded file is stored as a Blob. To show or play it, the page needs a
// URL, so each one gets an "object URL" (blob:...) that points at the Blob in
// memory. Those are released when a file is deleted or the app closes.

const KINDS = ['animations', 'audio']

// Built-ins made by code are known before anything loads, so they show at once.
function proceduralEntries(kind) {
  // eslint-disable-next-line no-unused-vars
  return PROCEDURAL[kind].map(({ render, ...entry }) => ({ ...entry, source: 'built-in' }))
}

function withoutRuntimeFields(item) {
  // eslint-disable-next-line no-unused-vars
  const { url, source, ...record } = item
  return record
}

export default function DataProvider({ children }) {
  const [library, setLibrary] = useState({ animations: proceduralEntries('animations'), audio: proceduralEntries('audio') })
  const [spells, setSpells] = useState([])
  const [spellsReadOnly, setSpellsReadOnly] = useState(false)
  const [recordings, setRecordings] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const objectUrls = useRef(new Set())
  // The latest spells, so several quick edits in a row each build on the last.
  const spellsRef = useRef([])

  const makeUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob)
    objectUrls.current.add(url)
    return url
  }, [])

  const dropUrl = useCallback((url) => {
    if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url)
  }, [])

  const replaceSpells = useCallback((next) => {
    spellsRef.current = next
    setSpells(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    requestPersistentStorage()
    const urls = objectUrls.current

    // Procedural audio is rendered to a WAV file in the background; its
    // player fills in a moment after the app opens.
    async function renderProcedural() {
      for (const kind of KINDS) {
        for (const { id, render } of PROCEDURAL[kind]) {
          if (!render) continue
          try {
            const { blob } = await render()
            if (cancelled) return
            const url = makeUrl(blob)
            setLibrary((current) => ({
              ...current,
              [kind]: current[kind].map((item) => (item.id === id ? { ...item, blob, size: blob.size, url } : item)),
            }))
          } catch (error) {
            console.error(`Could not render ${id}`, error)
          }
        }
      }
    }

    async function load() {
      const [files, uploads] = await Promise.all([
        Promise.all(KINDS.map(loadFileManifest)),
        Promise.all(KINDS.map((kind) => getAll(kind))),
      ])
      if (cancelled) return
      const next = {}
      KINDS.forEach((kind, i) => {
        next[kind] = [
          ...files[i].map((entry) => ({ ...entry, source: 'built-in' })),
          ...uploads[i]
            .sort((a, b) => a.addedAt - b.addedAt)
            .map((record) => ({ ...record, source: 'uploaded', url: makeUrl(record.blob) })),
        ]
      })
      // Keep the built-ins made by code as they are: their audio may already be rendered.
      setLibrary((current) => {
        const merged = {}
        for (const kind of KINDS) {
          merged[kind] = [...current[kind].filter((item) => item.procedural), ...next[kind]]
        }
        return merged
      })
      setLoaded(true)
    }

    async function loadSpells() {
      let fileSpells
      try {
        fileSpells = await listSpells()
      } catch {
        // No dev server: show the spells shipped with the app, read-only.
        const shipped = await loadBuiltInSpells()
        if (!cancelled) {
          replaceSpells(shipped)
          setSpellsReadOnly(true)
        }
        return
      }
      if (cancelled) return
      replaceSpells(fileSpells)
      // Spells made before spells were saved as files are still in this
      // browser's database: move them into files once, then remove them there.
      const old = await getAll('spells').catch(() => [])
      for (const spell of old.sort((a, b) => a.createdAt - b.createdAt)) {
        const file = await createSpellFile(spell)
        await remove('spells', spell.id)
        if (!cancelled) replaceSpells([...spellsRef.current, { ...spell, file }])
      }
    }

    async function loadRecordings() {
      const list = await listRecordings().catch(() => [])
      if (!cancelled) setRecordings(list)
    }

    renderProcedural()
    loadSpells().catch((error) => console.error('Could not load spells', error))
    loadRecordings()
    load().catch((error) => {
      console.error(error)
      if (!cancelled) setLoadError(`Could not open the saved library: ${error.message}`)
    })

    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [makeUrl, replaceSpells])

  // Returns { added: [items], rejected: [file names] }.
  const addFiles = useCallback(
    async (kind, fileList) => {
      const added = []
      const rejected = []
      for (const file of fileList) {
        if (!isAccepted(kind, file)) {
          rejected.push(file.name)
          continue
        }
        const record = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          addedAt: Date.now(),
          description: '',
          blob: file,
        }
        await put(kind, record)
        added.push({ ...record, source: 'uploaded', url: makeUrl(file) })
      }
      setLibrary((current) => ({ ...current, [kind]: [...current[kind], ...added] }))
      return { added, rejected }
    },
    [makeUrl],
  )

  const updateFile = useCallback(async (kind, item, changes) => {
    const next = { ...item, ...changes }
    setLibrary((current) => ({
      ...current,
      [kind]: current[kind].map((entry) => (entry.id === item.id ? next : entry)),
    }))
    await put(kind, withoutRuntimeFields(next))
  }, [])

  const removeFile = useCallback(
    async (kind, item) => {
      await remove(kind, item.id)
      dropUrl(item.url)
      setLibrary((current) => ({
        ...current,
        [kind]: current[kind].filter((entry) => entry.id !== item.id),
      }))
    },
    [dropUrl],
  )

  // template: an optional spell to copy ("Make a copy").
  const createSpell = useCallback(
    async (template = null) => {
      const copied = { ...template }
      delete copied.file
      delete copied.builtIn
      const spell = {
        name: 'New spell',
        description: '',
        gesture: null, // { examples: [{ recordedAt, aspect, duration, frames }] }
        animationId: null,
        audioId: null,
        sensitivity: 1,
        ...copied,
        id: `spell:${crypto.randomUUID()}`,
        createdAt: Date.now(),
      }
      if (template) spell.name = `${template.name} (copy)`
      const file = await createSpellFile(spell)
      const saved = { ...spell, file }
      replaceSpells([...spellsRef.current, saved])
      return saved
    },
    [replaceSpells],
  )

  // changes: an object, or a function of the current spell returning one.
  const updateSpell = useCallback(
    async (id, changes) => {
      const current = spellsRef.current.find((spell) => spell.id === id)
      if (!current) return
      const next = { ...current, ...(typeof changes === 'function' ? changes(current) : changes) }
      replaceSpells(spellsRef.current.map((spell) => (spell.id === id ? next : spell)))
      await saveSpellFile(current.file, next)
    },
    [replaceSpells],
  )

  const removeSpell = useCallback(
    async (id) => {
      const spell = spellsRef.current.find((s) => s.id === id)
      if (!spell) return
      await deleteSpellFile(spell.file)
      replaceSpells(spellsRef.current.filter((s) => s.id !== id))
    },
    [replaceSpells],
  )

  // ---------- recordings ----------

  // { blob, ext, meta, track }; meta.id names the recording's folder.
  const saveRecording = useCallback(async (recording) => {
    await saveRecordingFiles({ ...recording, id: recording.meta.id })
    setRecordings((current) => [...current, recording.meta])
  }, [])

  const recordingsRef = useRef([])
  useEffect(() => {
    recordingsRef.current = recordings
  }, [recordings])

  const updateRecording = useCallback(async (id, changes) => {
    const current = recordingsRef.current.find((meta) => meta.id === id)
    if (!current) return
    const next = { ...current, ...changes }
    setRecordings((list) => list.map((meta) => (meta.id === id ? next : meta)))
    await saveRecordingMeta(id, next)
  }, [])

  const deleteRecording = useCallback(async (id) => {
    await deleteRecordingFiles(id)
    setRecordings((current) => current.filter((meta) => meta.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      loaded,
      loadError,
      library,
      spells,
      spellsReadOnly,
      recordings,
      findFile: (kind, id) => (id ? library[kind].find((item) => item.id === id) : undefined),
      addFiles,
      updateFile,
      removeFile,
      createSpell,
      updateSpell,
      removeSpell,
      saveRecording,
      updateRecording,
      deleteRecording,
    }),
    [
      loaded,
      loadError,
      library,
      spells,
      spellsReadOnly,
      recordings,
      addFiles,
      updateFile,
      removeFile,
      createSpell,
      updateSpell,
      removeSpell,
      saveRecording,
      updateRecording,
      deleteRecording,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
