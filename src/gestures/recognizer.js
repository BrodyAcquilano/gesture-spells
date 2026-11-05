// Recognises spells live by comparing the last moment of hand movement with
// each spell's recorded examples. Nothing is trained: adding an example is
// enough.
//
// For each example of each spell:
//   1. take the live frames from the last (example duration × 1.25) ms
//   2. skip it if the hand moved much less than in the example
//   3. dynamic time warping distance between the two
// A spell's distance is its closest example. The spell fires when that
// distance is under the spell's threshold, which comes from how much the
// spell's own examples differ from each other: if they agree closely, a live
// movement has to be close too.
import { dtw } from './dtw.js'
import { prepareSequence } from './features.js'

const WINDOW_SCALE = 1.25
const MIN_WINDOW_FRAMES = 5
const MOVEMENT_FRACTION = 0.5
export const DEFAULT_THRESHOLD = 0.35 // used when a spell has only one example
const THRESHOLD_MARGIN = 1.6
const MIN_THRESHOLD = 0.2
const MAX_THRESHOLD = 0.6

function autoThreshold(prepared) {
  if (prepared.length < 2) return DEFAULT_THRESHOLD
  let worst = 0
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      worst = Math.max(worst, dtw(prepared[i].vectors, prepared[j].vectors))
    }
  }
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, worst * THRESHOLD_MARGIN))
}

// spells: those with gesture examples. sensitivity > 1 makes a spell easier
// to trigger, < 1 stricter.
export function buildRecognizer(spells) {
  const entries = spells
    .filter((spell) => spell.gesture?.examples?.length)
    .map((spell) => {
      const examples = spell.gesture.examples.map((example) => ({
        duration: Math.max(200, example.duration),
        ...prepareSequence(example.frames, example.aspect),
      }))
      const base = autoThreshold(examples)
      return { spell, examples, baseThreshold: base, threshold: base * (spell.sensitivity ?? 1) }
    })

  // history: recent live frames { t, label, points }, oldest first.
  // Returns { best: { spell, distance, threshold } | null, match: same | null }.
  function classify(history, now, aspect) {
    let best = null
    for (const entry of entries) {
      let closest = Infinity
      for (const example of entry.examples) {
        const window = history.filter((frame) => frame.t >= now - example.duration * WINDOW_SCALE)
        if (window.length < MIN_WINDOW_FRAMES) continue
        if (window[window.length - 1].t - window[0].t < example.duration * 0.7) continue
        const live = prepareSequence(window, aspect)
        if (live.movement < example.movement * MOVEMENT_FRACTION) continue
        closest = Math.min(closest, dtw(live.vectors, example.vectors))
      }
      if (closest === Infinity) continue
      const result = { spell: entry.spell, distance: closest, threshold: entry.threshold }
      if (!best || closest / entry.threshold < best.distance / best.threshold) best = result
    }
    return { best, match: best && best.distance < best.threshold ? best : null }
  }

  return { entries, classify }
}
