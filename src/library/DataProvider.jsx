import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAll, remove } from '../storage/db.js'
import { PROCEDURAL_SOUNDS, asLibraryItem, loadBuiltInSpells, loadLibraryIndex } from './builtins.js'
import {
  createSpellFile,
  deleteLibraryEntry,
  deleteRecordingFiles,
  deleteSpellFile,
  listRecordings,
  listSpells,
  saveRecordingFiles,
  saveRecordingMeta,
  saveSpellFile,
  updateLibraryEntry,
  uploadLibraryFile,
} from '../storage/projectApi.js'
import { isAccepted } from './formats.js'
import { DataContext } from './DataContext.js'

// Loads everything once when the app starts and keeps it in React state.
// Changes are saved straight away, so they survive a reload:
//   spells             files in public/library/spells/ (in the repository)
//   animations, sounds entries in public/library/animations/ and audio/
//                      index.json, with uploaded files beside them (in the
//                      repository, so spells that use them work anywhere)
//   recordings         files in recordings/ (local only, git-ignored)
// They are written by the dev server (server/storage.js), because a page
// can't write files itself. Without it (a static build) everything is
// read-only and there are no recordings.
//
// Earlier versions kept spells and uploads in the browser's database
// (IndexedDB); anything found there is moved into files once.
//
// Sounds made by code are rendered into Blobs in memory. To play one, the
// page needs a URL, so each gets an "object URL" (blob:...), released when
// the app closes.

const KINDS = ['animations', 'audio']


export default function DataProvider({ children }) {
  const [library, setLibrary] = useState({ animations: [], audio: [] })
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

  const replaceSpells = useCallback((next) => {
    spellsRef.current = next
    setSpells(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const urls = objectUrls.current

    // Sounds made by code are rendered into WAV files in the background;
    // their players fill in a moment after the app opens.
    async function renderSounds(items) {
      for (const { id, procedural } of items) {
        const render = PROCEDURAL_SOUNDS[procedural]
        if (!render) continue
        try {
          const { blob } = await render()
          if (cancelled) return
          const url = makeUrl(blob)
          setLibrary((current) => ({
            ...current,
            audio: current.audio.map((item) => (item.id === id ? { ...item, blob, size: blob.size, url } : item)),
          }))
        } catch (error) {
          console.error(`Could not render ${id}`, error)
        }
      }
    }

    async function load() {
      const [animations, audio] = await Promise.all(KINDS.map(loadLibraryIndex))
      if (cancelled) return
      setLibrary({ animations, audio })
      setLoaded(true)
      await renderSounds(audio.filter((item) => item.procedural))
      await moveOldUploads()
    }

    // Uploads made before uploads were saved as files are still in this
    // browser's database: save each into the project (keeping its id, so
    // spells that use it still find it), then remove it there.
    async function moveOldUploads() {
      for (const kind of KINDS) {
        const old = await getAll(kind).catch(() => [])
        for (const record of old.sort((a, b) => a.addedAt - b.addedAt)) {
          const file = new File([record.blob], record.name, { type: record.type })
          const entry = await uploadLibraryFile(kind, file, record.id)
          if (record.description) {
            await updateLibraryEntry(kind, entry.id, { description: record.description })
            entry.description = record.description
          }
          await remove(kind, record.id)
          if (!cancelled) setLibrary((current) => ({ ...current, [kind]: [...current[kind], asLibraryItem(kind, entry)] }))
        }
      }
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

  // Saves uploaded files into the project. Returns { added: [items], rejected: [file names] }.
  const addFiles = useCallback(async (kind, fileList) => {
    const added = []
    const rejected = []
    for (const file of fileList) {
      if (!isAccepted(kind, file)) {
        rejected.push(file.name)
        continue
      }
      added.push(asLibraryItem(kind, await uploadLibraryFile(kind, file)))
    }
    setLibrary((current) => ({ ...current, [kind]: [...current[kind], ...added] }))
    return { added, rejected }
  }, [])

  // changes: { name?, description? }
  const updateFile = useCallback(async (kind, item, changes) => {
    const next = { ...item, ...changes }
    setLibrary((current) => ({
      ...current,
      [kind]: current[kind].map((entry) => (entry.id === item.id ? next : entry)),
    }))
    await updateLibraryEntry(kind, item.id, changes)
  }, [])

  // Deletes an animation or sound: its entry, and its file if it has one.
  const removeFile = useCallback(async (kind, item) => {
    await deleteLibraryEntry(kind, item.id)
    setLibrary((current) => ({
      ...current,
      [kind]: current[kind].filter((entry) => entry.id !== item.id),
    }))
  }, [])

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
