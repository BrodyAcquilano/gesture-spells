// Turns a recorded or live hand movement into numbers that can be compared.
//
// A movement is a list of frames { t (ms), label ('Left'|'Right'), points }.
// Each frame becomes one feature vector of 53 numbers:
//
//   40  hand shape: landmarks 1–20 relative to the wrist, divided by the palm
//       length (wrist to the base of the middle finger), and turned so the
//       palm points straight up. This ignores where the hand is, how far it
//       is from the camera and how much it is tilted.
//    4  thumb tip to each fingertip, divided by palm length. These capture
//       pinches and other finger contacts strongly.
//    2  path: where the hand is relative to its average position during the
//       movement, in palm lengths. This captures drawing in the air, swipes
//       and pushes.
//    1  facing: which way the hand faces, palm or back towards the camera.
//       Seen from the front, the index knuckle is on one side of the line
//       from the wrist to the little-finger knuckle; turned over, it is on
//       the other. The signed area of that triangle (the "cross product"),
//       divided by the palm length squared, goes from about +0.5 to −0.5 as
//       the hand turns over. A snap done with the palm towards yourself
//       turns the hand over; a pinch doesn't.
//    1  depth: how much bigger or smaller the hand looks than at the end (or
//       on average), as a logarithm. A hand pushed towards the camera grows:
//       this is what tells a fireball push from simply opening the hand.
//    5  curl: each fingertip's distance from the wrist, divided by palm
//       length: about 1 curled into a fist, about 2 straight. Unlike the
//       hand shape above it hardly depends on whose hand it is or how the
//       camera sees it.
// Each group is multiplied by a weight (DEFAULT_FEATURES below; the
// recogniser passes its own tuned weights).
//
// Left hand shapes are mirrored to look like right hands, so a gesture
// recorded with one hand is recognised with either.
import { FINGERTIPS, MIDDLE_BASE, THUMB_TIP, WRIST } from '../tracking/landmarks.js'

const INDEX_BASE = 5
const PINKY_BASE = 17

export const RESAMPLE_STEPS = 24

// How much each kind of number counts when two movements are compared.
//   shapeWeight  the hand shape (landmarks relative to the wrist)
//   tipWeight    thumb-to-fingertip distances
//   pathWeight   where the hand moves
// The recogniser's tuned values are in recognizer.js (DEFAULT_SETTINGS).
export const DEFAULT_FEATURES = { shapeWeight: 1, tipWeight: 3, pathWeight: 0.5, facingWeight: 0 }

function frameFeatures(points, aspect, label, weights) {
  const { shapeWeight, tipWeight } = weights
  // x is a fraction of the width and y of the height; multiplying x by the
  // aspect ratio puts both in the same unit before measuring distances.
  const flip = label === 'Left' ? -1 : 1
  const px = (i) => points[i][0] * aspect
  const py = (i) => points[i][1]
  const palm = Math.hypot(px(MIDDLE_BASE) - px(WRIST), py(MIDDLE_BASE) - py(WRIST)) || 1e-6
  // up: from the wrist to the base of the middle finger; right: across it.
  const ux = (px(MIDDLE_BASE) - px(WRIST)) / palm
  const uy = (py(MIDDLE_BASE) - py(WRIST)) / palm
  const vector = new Float64Array(53)
  let k = 0
  for (let i = 1; i < 21; i++) {
    const dx = (px(i) - px(WRIST)) / palm
    const dy = (py(i) - py(WRIST)) / palm
    vector[k++] = (dx * -uy + dy * ux) * flip * shapeWeight
    vector[k++] = -(dx * ux + dy * uy) * shapeWeight
  }
  for (const tip of FINGERTIPS) {
    vector[k++] = (Math.hypot(px(tip) - px(THUMB_TIP), py(tip) - py(THUMB_TIP)) / palm) * tipWeight
  }
  // Facing: signed area of wrist → index knuckle → little-finger knuckle.
  const ax = px(INDEX_BASE) - px(WRIST)
  const ay = py(INDEX_BASE) - py(WRIST)
  const bx = px(PINKY_BASE) - px(WRIST)
  const by = py(PINKY_BASE) - py(WRIST)
  vector[46] = ((ax * by - ay * bx) / (palm * palm)) * flip * (weights.facingWeight ?? 0)
  ;[THUMB_TIP, ...FINGERTIPS].forEach((tip, j) => {
    vector[48 + j] = (Math.hypot(px(tip) - px(WRIST), py(tip) - py(WRIST)) / palm) * (weights.curlWeight ?? 0)
  })
  // Filled in by sequenceFeatures, which knows the whole movement.
  // The path is not mirrored: a swipe to the right stays a swipe to the right.
  return { vector, palm, x: px(MIDDLE_BASE), y: py(MIDDLE_BASE) }
}

// Feature vectors for every frame, lightly smoothed over time to calm the
// tracker's frame-to-frame jitter.
// pathFrom: 'mean' measures the path from the hand's average position; 'end'
// from where it ends up (the recogniser compares movements that end together).
export function sequenceFeatures(frames, aspect, weights = DEFAULT_FEATURES, pathFrom = 'mean') {
  const rows = frames.map((frame) => frameFeatures(frame.points, aspect, frame.label, weights))
  const n = rows.length
  const meanPalm = rows.reduce((sum, row) => sum + row.palm, 0) / n
  const originX = pathFrom === 'end' ? rows[n - 1].x : rows.reduce((sum, row) => sum + row.x, 0) / n
  const originY = pathFrom === 'end' ? rows[n - 1].y : rows.reduce((sum, row) => sum + row.y, 0) / n
  const originPalm = pathFrom === 'end' ? rows[n - 1].palm : meanPalm
  for (const row of rows) {
    row.vector[44] = ((row.x - originX) / meanPalm) * weights.pathWeight
    row.vector[45] = ((row.y - originY) / meanPalm) * weights.pathWeight
    row.vector[47] = Math.log(row.palm / originPalm) * (weights.depthWeight ?? 0)
  }
  return rows.map((row, i) => {
    const before = rows[Math.max(0, i - 1)].vector
    const after = rows[Math.min(n - 1, i + 1)].vector
    return row.vector.map((value, d) => (before[d] + 2 * value + after[d]) / 4)
  })
}

// Resamples vectors taken at uneven times to `steps` evenly spaced times, by
// straight-line interpolation. Recordings then have the same length whatever
// the camera's frame rate was.
export function resample(times, vectors, steps = RESAMPLE_STEPS) {
  const start = times[0]
  const end = times[times.length - 1]
  const out = []
  let j = 0
  for (let s = 0; s < steps; s++) {
    const t = steps === 1 ? start : start + ((end - start) * s) / (steps - 1)
    while (j < times.length - 2 && times[j + 1] < t) j++
    const span = times[j + 1] - times[j]
    const f = span > 0 ? Math.min(1, Math.max(0, (t - times[j]) / span)) : 0
    const a = vectors[j]
    const b = vectors[Math.min(j + 1, vectors.length - 1)]
    out.push(a.map((value, d) => value + (b[d] - value) * f))
  }
  return out
}

export function distance(a, b) {
  let sum = 0
  for (let d = 0; d < a.length; d++) sum += (a[d] - b[d]) ** 2
  return Math.sqrt(sum)
}

// How far the hand gets from where it started: the largest distance of any
// frame from the first one. A still or jittering hand scores close to 0.
export function movementOf(vectors) {
  let most = 0
  for (const vector of vectors) most = Math.max(most, distance(vector, vectors[0]))
  return most
}

// Everything the recogniser needs from one movement.
export function prepareSequence(frames, aspect, weights = DEFAULT_FEATURES) {
  const vectors = resample(
    frames.map((frame) => frame.t),
    sequenceFeatures(frames, aspect, weights),
  )
  return { vectors, movement: movementOf(vectors) }
}

// The moment a movement arrives at its final pose: for a pinch, when the
// fingers touch. Found as the first frame, after the hand was furthest from
// its final pose, that is within a quarter of that distance of it. Spells
// cast at this moment rather than at the end of the recording, which may
// include the hand holding still.
export function arrivalTime(frames, aspect) {
  const vectors = sequenceFeatures(frames, aspect)
  const tail = vectors.slice(-3)
  const finalPose = tail[0].map((_, d) => tail.reduce((sum, v) => sum + v[d], 0) / tail.length)
  const away = vectors.map((vector) => distance(vector, finalPose))
  let peak = 0
  for (let i = 1; i < away.length; i++) if (away[i] > away[peak]) peak = i
  for (let i = peak; i < away.length; i++) {
    if (away[i] < away[peak] * 0.25) return frames[i].t
  }
  return frames[frames.length - 1].t
}
