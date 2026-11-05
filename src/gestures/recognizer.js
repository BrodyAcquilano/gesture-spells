// Recognises spells live by comparing the last moment of hand movement with
// each spell's recorded examples. Nothing is trained: adding an example is
// enough.
//
// Only the END of a gesture is compared (the last TAIL fraction of each
// example), so the hand can start from any position: the recorded starting
// pose is left out of the comparison. And "the end" means the moment the hand
// arrives at its final pose (for a pinch, when the fingers touch), not the end
// of the recording, so a spell casts at that moment instead of waiting for
// the hand to hold still.
//
// For each example of each spell:
//   1. take the live frames covering the same stretch of time (× 1.25 slack)
//   2. skip it if the hand moved much less than in that part of the example
//   3. dynamic time warping distance between the two, plus a term for how
//      far apart their final poses are
// A spell's distance is its closest example. The spell fires when that
// distance is under the spell's threshold. The threshold comes from two
// things:
//   - how much the spell's own examples differ from each other: if they agree
//     closely, a live movement has to be close too
//   - how close the nearest movement that must NOT cast it comes: the other
//     spells' examples, and the spell's own examples played backwards (a
//     pinch released instead of pressed). The threshold stays below
//     MARGIN × that distance, so similar spells can't set each other off.
import { dtw } from './dtw.js'
import { arrivalTime, distance, prepareSequence } from './features.js'

export const TAIL = 0.6
const AFTER_ARRIVAL_MS = 50 // keep a frame or so past the arrival moment
const WINDOW_SCALE = 1.25
const MIN_WINDOW_FRAMES = 4
const MOVEMENT_FRACTION = 0.5
export const DEFAULT_THRESHOLD = 0.5 // used when a spell has only one example
const THRESHOLD_MARGIN = 2.0
const MIN_THRESHOLD = 0.3
const MAX_THRESHOLD = 0.9
const MARGIN = 0.65
const END_WEIGHT = 0.3

// The end part of a recorded example, up to its arrival moment, re-timed to
// start at 0.
function tailOf(example) {
  const end = Math.min(example.duration, arrivalTime(example.frames, example.aspect) + AFTER_ARRIVAL_MS)
  const from = end * (1 - TAIL)
  let frames = example.frames.filter((frame) => frame.t >= from && frame.t <= end)
  if (frames.length < MIN_WINDOW_FRAMES) frames = example.frames.slice(-MIN_WINDOW_FRAMES)
  const start = frames[0].t
  return { frames: frames.map((frame) => ({ ...frame, t: frame.t - start })), duration: frames[frames.length - 1].t - start }
}

// How different two movements are: the DTW distance, plus a little extra for
// how far apart their final poses are. DTW averages over the whole movement,
// so on its own a gesture that ends in the wrong pose (a snap undone instead
// of done) can still score close; the end term makes the ending count.
function score(a, b) {
  return dtw(a, b) + END_WEIGHT * distance(a[a.length - 1], b[b.length - 1])
}

function autoThreshold(prepared) {
  if (prepared.length < 2) return DEFAULT_THRESHOLD
  let worst = 0
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      worst = Math.max(worst, score(prepared[i].vectors, prepared[j].vectors))
    }
  }
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, worst * THRESHOLD_MARGIN))
}

function prepareExample(example) {
  const tail = tailOf(example)
  return { duration: Math.max(150, tail.duration), ...prepareSequence(tail.frames, example.aspect) }
}

// The same movement backwards in time.
function reversedExample(example) {
  const frames = [...example.frames].reverse().map((frame) => ({ ...frame, t: example.duration - frame.t }))
  return { ...example, frames }
}

// spells: those with gesture examples. sensitivity > 1 makes a spell easier
// to trigger, < 1 stricter.
export function buildRecognizer(spells) {
  const withGestures = spells.filter((spell) => spell.gesture?.examples?.length)
  const prepared = withGestures.map((spell) => spell.gesture.examples.map(prepareExample))
  const entries = withGestures.map((spell, s) => {
    const examples = prepared[s]
    const negatives = [
      ...spell.gesture.examples.map((example) => prepareExample(reversedExample(example))),
      ...prepared.filter((_, other) => other !== s).flat(),
    ]
    let nearestNegative = Infinity
    for (const example of examples) {
      for (const negative of negatives) nearestNegative = Math.min(nearestNegative, score(example.vectors, negative.vectors))
    }
    const base = Math.min(autoThreshold(examples), MARGIN * nearestNegative)
    return { spell, examples, baseThreshold: base, nearestNegative, threshold: base * (spell.sensitivity ?? 1) }
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
        closest = Math.min(closest, score(live.vectors, example.vectors))
      }
      if (closest === Infinity) continue
      const result = { spell: entry.spell, distance: closest, threshold: entry.threshold }
      if (!best || closest / entry.threshold < best.distance / best.threshold) best = result
    }
    return { best, match: best && best.distance < best.threshold ? best : null }
  }

  return { entries, classify }
}
