// Library entries that come with the app.
//
// Procedural entries are made by code in src/effects/ rather than loaded from
// a file. Animations are drawn live. Audio is rendered once when the app
// starts into a real WAV file, so it plays in an ordinary audio player. File
// entries are listed in public/library/<kind>/index.json and served from there.
import { renderSparkChime } from '../effects/sparkSound.js'

export const PROCEDURAL = {
  animations: [
    {
      id: 'builtin:sparks',
      name: 'Sparks ✨',
      procedural: 'sparks',
      description: 'A burst of ✨ sparks that fly out, fall and fade over about 1.3 s. Drawn by code (src/effects/sparks.js).',
    },
  ],
  audio: [
    {
      id: 'builtin:spark-chime',
      name: 'Spark chime',
      procedural: 'spark-chime',
      render: renderSparkChime,
      description:
        'A rippling bell chime with a sparkly shimmer and an echo, about 1.8 s long, fading out like the sparks animation. Computed sample by sample in JavaScript and saved as a WAV file (src/effects/sparkSound.js).',
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
