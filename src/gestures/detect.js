// Finds the spells cast in a recorded hand track, after the fact, the same
// way live casting does: feed the frames in order, check every other frame,
// and wait a second after each cast before the next.
//   track: [{ t (seconds), label, points }]
// Returns [{ t, spellId, points }].
import { buildRecognizer } from './recognizer.js'

const HISTORY_SECONDS = 4
const COOLDOWN_SECONDS = 1

export function detectCasts(track, spells, aspect) {
  const recognizer = buildRecognizer(spells)
  if (!recognizer.entries.length) return []
  const casts = []
  let history = []
  let cooldown = -Infinity
  track.forEach((frame, i) => {
    const previous = history[history.length - 1]
    if (previous && frame.t - previous.t > 0.3) history = [] // the hand was lost for a moment
    history.push({ t: frame.t * 1000, label: frame.label, points: frame.points })
    while (history.length && history[0].t < (frame.t - HISTORY_SECONDS) * 1000) history.shift()
    if (i % 2 || frame.t < cooldown) return
    const { match } = recognizer.classify(history, frame.t * 1000, aspect)
    if (match) {
      casts.push({ t: frame.t, spellId: match.spell.id, points: frame.points })
      cooldown = frame.t + COOLDOWN_SECONDS
      history = []
    }
  })
  return casts
}
