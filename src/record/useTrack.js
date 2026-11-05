import { useEffect, useState } from 'react'
import { loadTrack } from '../storage/projectApi.js'

// Loads a recording's hand track (track.json) once per recording id.
// Returns the track array, or null while it is loading.
const cache = new Map()

export function useTrack(id) {
  const [loaded, setLoaded] = useState(() => (id && cache.has(id) ? { id, track: cache.get(id) } : null))
  useEffect(() => {
    if (!id || cache.has(id)) return
    let cancelled = false
    loadTrack(id)
      .catch(() => [])
      .then((track) => {
        cache.set(id, track)
        if (!cancelled) setLoaded({ id, track })
      })
    return () => {
      cancelled = true
    }
  }, [id])
  if (!id) return null
  if (cache.has(id)) return cache.get(id)
  return loaded?.id === id ? loaded.track : null
}
