import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAll, put, remove, requestPersistentStorage } from '../storage/db.js'
import { PROCEDURAL, loadBuiltInSpells, loadFileManifest } from './builtins.js'
import { isAccepted } from './formats.js'
import { DataContext } from './DataContext.js'

// Loads everything once when the app starts and keeps it in React state.
// Changes are written to IndexedDB straight away, so they survive a reload.
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
  const [spells, setSpells] = useState([]) // your own spells
  const [builtInSpells, setBuiltInSpells] = useState([])
  const [takes, setTakes] = useState([])
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
      const [files, uploads, savedSpells, savedTakes] = await Promise.all([
        Promise.all(KINDS.map(loadFileManifest)),
        Promise.all(KINDS.map((kind) => getAll(kind))),
        getAll('spells'),
        getAll('takes'),
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
      replaceSpells(savedSpells.sort((a, b) => a.createdAt - b.createdAt))
      setTakes(savedTakes.sort((a, b) => a.createdAt - b.createdAt))
      setLoaded(true)
    }

    renderProcedural()
    // Packaged spells come from the app itself, so they need not wait for the database.
    loadBuiltInSpells().then((packaged) => {
      if (!cancelled) setBuiltInSpells(packaged)
    })
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

  // template: an optional spell to copy, such as a built-in one.
  const createSpell = useCallback(async (template = null) => {
    const spell = {
      name: 'New spell',
      description: '',
      gesture: null, // { examples: [{ recordedAt, aspect, duration, frames }] }
      animationId: null,
      audioId: null,
      sensitivity: 1,
      ...template,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    delete spell.builtIn
    if (template) spell.name = `${template.name} (copy)`
    await put('spells', spell)
    replaceSpells([...spellsRef.current, spell])
    return spell
  }, [replaceSpells])

  // changes: an object, or a function of the current spell returning one.
  const updateSpell = useCallback(
    async (id, changes) => {
      const current = spellsRef.current.find((spell) => spell.id === id)
      if (!current) return
      const next = { ...current, ...(typeof changes === 'function' ? changes(current) : changes) }
      replaceSpells(spellsRef.current.map((spell) => (spell.id === id ? next : spell)))
      await put('spells', next)
    },
    [replaceSpells],
  )

  const removeSpell = useCallback(
    async (id) => {
      await remove('spells', id)
      replaceSpells(spellsRef.current.filter((spell) => spell.id !== id))
    },
    [replaceSpells],
  )

  const value = useMemo(
    () => ({
      loaded,
      loadError,
      library,
      spells: [...builtInSpells, ...spells],
      takes,
      findFile: (kind, id) => (id ? library[kind].find((item) => item.id === id) : undefined),
      addFiles,
      updateFile,
      removeFile,
      createSpell,
      updateSpell,
      removeSpell,
    }),
    [loaded, loadError, library, spells, builtInSpells, takes, addFiles, updateFile, removeFile, createSpell, updateSpell, removeSpell],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
