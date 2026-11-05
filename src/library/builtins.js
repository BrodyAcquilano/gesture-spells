// Library entries that come with the app.
//
// Procedural entries are made by code in src/effects/ rather than loaded from
// a file. Animations are drawn live. Audio is rendered once when the app
// starts into a real WAV file, so it plays in an ordinary audio player. File
// entries are listed in public/library/<kind>/index.json and served from there.
// Packaged spells (gesture examples included) are JSON files listed in
// public/library/spells/index.json.
import { renderSparkChime } from '../effects/sparkSound.js'
import { renderFireCrackle } from '../effects/fireSound.js'

export const PROCEDURAL = {
  animations: [
    {
      id: 'builtin:coins',
      name: 'Coins 🪙',
      procedural: 'coins',
      description:
        'A quick burst of spinning 🪙 gold coins that fly out from the pinch and fade in under half a second. Drawn by code (src/effects/coins.js).',
    },
    {
      id: 'builtin:illumination',
      name: 'Illumination',
      procedural: 'illumination',
      description:
        'A point of warm white light that flares at the index fingertip with a flash ring and crossing light streaks, glows, and fades over about 2 s. Drawn by code (src/effects/illumination.js).',
    },
    {
      id: 'builtin:fireball',
      name: 'Fireball',
      procedural: 'fireball',
      description:
        'A ball of fire forms at the palm and rushes towards the camera, growing as it comes, then bursts into flames and embers (about 2 s). Red, orange and yellow light drawn by code (src/effects/fireball.js).',
    },
  ],
  audio: [
    {
      id: 'builtin:spark-chime',
      name: 'Spark chime',
      procedural: 'spark-chime',
      render: renderSparkChime,
      description:
        'A bright strike, then a rippling bell chime with a sparkly shimmer and an echo, about 1.8 s, fading out. Used by Pinch coins. Computed sample by sample in JavaScript and saved as a WAV file (src/effects/sparkSound.js).',
    },
    {
      id: 'builtin:fire-crackle',
      name: 'Fire crackle',
      procedural: 'fire-crackle',
      render: renderFireCrackle,
      description:
        'A rushing whoosh and roar with crackles and pops, building for 0.9 s like the fireball, then dying away (2 s). Computed sample by sample in JavaScript and saved as a WAV file (src/effects/fireSound.js).',
    },
  ],
}

export async function loadFileManifest(kind) {
  const base = `${import.meta.env.BASE_URL}library/${kind}/`
  try {
    const response = await fetch(`${base}index.json`)
    if (!response.ok) return []
    const entries = await response.json()
    return entries.map((entry) => ({ ...entry, url: base + entry.file, name: entry.name ?? entry.file }))
  } catch {
    return []
  }
}

// Spells that ship with the app. They are read-only; "Make a copy" in the
// Spellbook turns one into an editable spell of your own.
export async function loadBuiltInSpells() {
  const base = `${import.meta.env.BASE_URL}library/spells/`
  try {
    const response = await fetch(`${base}index.json`)
    if (!response.ok) return []
    const files = await response.json()
    const spells = await Promise.all(
      files.map(async (file) => {
        const spellResponse = await fetch(base + file)
        return spellResponse.ok ? { ...(await spellResponse.json()), builtIn: true } : null
      }),
    )
    return spells.filter(Boolean)
  } catch {
    return []
  }
}
