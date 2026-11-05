// Loading the library and spells from public/library/.
//
// Every animation and sound is an entry in public/library/<kind>/index.json
// (<kind> is animations or audio). An entry either has a `file` in that
// folder (an upload), or a `procedural` name: then it is made by code in
// src/effects/. Animations made by code are drawn live (see
// src/effects/animations.js); sounds made by code are rendered once when the
// app starts into a WAV file, so they play like any other sound.
// Spells are JSON files listed in public/library/spells/index.json.
import { renderSparkChime } from '../effects/sparkSound.js'
import { renderFireCrackle } from '../effects/fireSound.js'
import { renderLightSwell } from '../effects/lightSound.js'
import { renderClockTick } from '../effects/clockSound.js'

// The code behind each sound's `procedural` name.
export const PROCEDURAL_SOUNDS = {
  'spark-chime': renderSparkChime,
  'light-swell': renderLightSwell,
  'fire-crackle': renderFireCrackle,
  'clock-tick': renderClockTick,
}

export const libraryBase = (kind) => `${import.meta.env.BASE_URL}library/${kind}/`

// An index entry as the app uses it: `source` is 'procedural' or 'file', and
// files get the URL they are served from.
export function asLibraryItem(kind, entry) {
  if (entry.procedural) return { ...entry, source: 'procedural' }
  return { ...entry, source: 'file', url: libraryBase(kind) + entry.file, name: entry.name ?? entry.file }
}

export async function loadLibraryIndex(kind) {
  try {
    const response = await fetch(`${libraryBase(kind)}index.json`)
    if (!response.ok) return []
    const entries = await response.json()
    return entries.map((entry) => asLibraryItem(kind, entry))
  } catch {
    return []
  }
}

// The spell files read straight from public/, for when the dev server (which
// normally lists and saves them, see server/storage.js) isn't running. Spells
// are read-only then.
export async function loadBuiltInSpells() {
  const base = `${import.meta.env.BASE_URL}library/spells/`
  try {
    const response = await fetch(`${base}index.json`)
    if (!response.ok) return []
    const files = await response.json()
    const spells = await Promise.all(
      files.map(async (file) => {
        const spellResponse = await fetch(base + file)
        return spellResponse.ok ? { ...(await spellResponse.json()), file } : null
      }),
    )
    return spells.filter(Boolean)
  } catch {
    return []
  }
}
