// Library entries that come with the app.
//
// Procedural entries are drawn or synthesised by code in src/effects/ rather
// than loaded from a file. File entries are listed in
// public/library/<kind>/index.json and served from that folder.

export const PROCEDURAL = {
  animations: [
    {
      id: 'builtin:sparks',
      name: 'Sparks ✨',
      procedural: 'sparks',
      description: 'A burst of ✨ sparks, drawn by code (src/effects/sparks.js). Used by the pinch test spell.',
    },
  ],
  audio: [
    {
      id: 'builtin:spark-ting',
      name: 'Spark ting',
      procedural: 'spark-ting',
      description: 'A rising two-tone ting synthesised with Web Audio (src/effects/sparkSound.js).',
    },
  ],
}

export const BUILTIN_SPELLS = [
  {
    id: 'builtin:pinch-spark',
    name: 'Pinch spark (test)',
    description:
      'Touch thumb and index finger together to throw sparks. Try it live in the Record tab. It uses a fixed pinch rule rather than a recorded gesture.',
    gesture: { kind: 'pinch', label: 'Pinch (thumb + index finger)' },
    animationId: 'builtin:sparks',
    audioId: 'builtin:spark-ting',
    builtIn: true,
  },
]

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
