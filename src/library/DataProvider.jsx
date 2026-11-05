import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAll, put, remove, requestPersistentStorage } from '../storage/db.js'
import { BUILTIN_SPELLS, PROCEDURAL, loadFileManifest } from './builtins.js'
import { isAccepted } from './formats.js'
import { DataContext } from './DataContext.js'

// Loads everything once when the app starts and keeps it in React state.
// Changes are written to IndexedDB straight away, so they survive a reload.
//
// An uploaded file is stored as a Blob. To show or play it, the page needs a
// URL, so each one gets an "object URL" (blob:...) that points at the Blob in
// memory. Those are released when a file is deleted or the app closes.

function withoutRuntimeFields(item) {
  // eslint-disable-next-line no-unused-vars
  const { url, source, ...record } = item
  return record
}

export default function DataProvider({ children }) {
  const [library, setLibrary] = useState({ animations: [], audio: [] })
  const [userSpells, setUserSpells] = useState([])
  const [takes, setTakes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const objectUrls = useRef(new Set())

  const makeUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob)
    objectUrls.current.add(url)
    return url
  }, [])

  const dropUrl = useCallback((url) => {
    if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    let cancelled = false
    requestPersistentStorage()
    const urls = objectUrls.current

    async function load() {
      const kinds = ['animations', 'audio']
      const [files, uploads, spells, savedTakes] = await Promise.all([
        Promise.all(kinds.map(loadFileManifest)),
        Promise.all(kinds.map((kind) => getAll(kind))),
        getAll('spells'),
        getAll('takes'),
      ])
      if (cancelled) return
      const next = {}
      kinds.forEach((kind, i) => {
        next[kind] = [
          ...PROCEDURAL[kind].map((entry) => ({ ...entry, source: 'built-in' })),
          ...files[i].map((entry) => ({ ...entry, source: 'built-in' })),
          ...uploads[i]
            .sort((a, b) => a.addedAt - b.addedAt)
            .map((record) => ({ ...record, source: 'uploaded', url: makeUrl(record.blob) })),
        ]
      })
      setLibrary(next)
      setUserSpells(spells.sort((a, b) => a.createdAt - b.createdAt))
      setTakes(savedTakes.sort((a, b) => a.createdAt - b.createdAt))
      setLoaded(true)
    }

    load().catch((error) => {
      if (!cancelled) setLoadError(`Could not open the saved library: ${error.message}`)
    })

    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [makeUrl])

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

  const createSpell = useCallback(async () => {
    const spell = {
      id: crypto.randomUUID(),
      name: 'New spell',
      description: '',
      createdAt: Date.now(),
      gesture: null,
      animationId: null,
      audioId: null,
    }
    await put('spells', spell)
    setUserSpells((current) => [...current, spell])
    return spell
  }, [])

  const updateSpell = useCallback(async (spell, changes) => {
    const next = { ...spell, ...changes }
    setUserSpells((current) => current.map((entry) => (entry.id === spell.id ? next : entry)))
    await put('spells', next)
  }, [])

  const removeSpell = useCallback(async (spell) => {
    await remove('spells', spell.id)
    setUserSpells((current) => current.filter((entry) => entry.id !== spell.id))
  }, [])

  const value = useMemo(
    () => ({
      loaded,
      loadError,
      library,
      spells: [...BUILTIN_SPELLS, ...userSpells],
      takes,
      findFile: (kind, id) => (id ? library[kind].find((item) => item.id === id) : undefined),
      addFiles,
      updateFile,
      removeFile,
      createSpell,
      updateSpell,
      removeSpell,
    }),
    [loaded, loadError, library, userSpells, takes, addFiles, updateFile, removeFile, createSpell, updateSpell, removeSpell],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
