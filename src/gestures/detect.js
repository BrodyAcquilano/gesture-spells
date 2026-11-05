// Finds the spells cast in a recorded hand track, after the fact, exactly as
// live casting does: the frames go through the same live matcher, which casts
// when the hand settles after a gesture.
//   track: [{ t (seconds), label, points }]
// Returns [{ t, spellId, points }].
import { buildRecognizer, createLiveMatcher } from './recognizer.js'

export function detectCasts(track, spells, aspect) {
  const recognizer = buildRecognizer(spells)
  if (!recognizer.entries.length) return []
  const matcher = createLiveMatcher(recognizer)
  const casts = []
  for (const frame of track) {
    const result = matcher.push({ t: frame.t * 1000, label: frame.label, points: frame.points }, aspect)
    if (result?.match) casts.push({ t: frame.t, spellId: result.match.spell.id, points: frame.points })
  }
  return casts
}
