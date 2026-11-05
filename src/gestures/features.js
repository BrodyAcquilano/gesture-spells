// Turns a recorded or live hand movement into numbers that can be compared.
//
// A movement is a list of frames { t (ms), label ('Left'|'Right'), points }.
// Each frame becomes one feature vector of 46 numbers:
//
//   40  hand shape: landmarks 1–20 relative to the wrist, divided by the palm
//       length (wrist to the base of the middle finger). This ignores where the
//       hand is and how far it is from the camera.
//    4  thumb tip to each fingertip, divided by palm length, weighted ×3.
//       These capture pinches and other finger contacts strongly.
//    2  path: where the hand is relative to its average position during the
//       movement, in palm lengths, weighted ×0.5. This captures drawing in
//       the air, swipes and pushes.
//
// Left hand shapes are mirrored to look like right hands, so a gesture
// recorded with one hand is recognised with either.
import { FINGERTIPS, MIDDLE_BASE, THUMB_TIP, WRIST } from '../tracking/landmarks.js'

export const FEATURE_SIZE = 46
const TIP_WEIGHT = 3
const PATH_WEIGHT = 0.5
export const RESAMPLE_STEPS = 24

function frameFeatures(points, aspect, label) {
  // x is a fraction of the width and y of the height; multiplying x by the
  // aspect ratio puts both in the same unit before measuring distances.
  const flip = label === 'Left' ? -1 : 1
  const px = (i) => points[i][0] * aspect
  const py = (i) => points[i][1]
  const palm = Math.hypot(px(MIDDLE_BASE) - px(WRIST), py(MIDDLE_BASE) - py(WRIST)) || 1e-6
  const vector = new Float64Array(FEATURE_SIZE)
  let k = 0
  for (let i = 1; i < 21; i++) {
    vector[k++] = ((px(i) - px(WRIST)) / palm) * flip
    vector[k++] = (py(i) - py(WRIST)) / palm
  }
  for (const tip of FINGERTIPS) {
    vector[k++] = (Math.hypot(px(tip) - px(THUMB_TIP), py(tip) - py(THUMB_TIP)) / palm) * TIP_WEIGHT
  }
  // Filled in by sequenceFeatures, which knows the whole movement.
  // The path is not mirrored: a swipe to the right stays a swipe to the right.
  return { vector, palm, x: px(MIDDLE_BASE), y: py(MIDDLE_BASE) }
}

// Feature vectors for every frame, lightly smoothed over time to calm the
// tracker's frame-to-frame jitter.
export function sequenceFeatures(frames, aspect) {
  const rows = frames.map((frame) => frameFeatures(frame.points, aspect, frame.label))
  const n = rows.length
  const meanPalm = rows.reduce((sum, row) => sum + row.palm, 0) / n
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / n
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / n
  for (const row of rows) {
    row.vector[44] = ((row.x - meanX) / meanPalm) * PATH_WEIGHT
    row.vector[45] = ((row.y - meanY) / meanPalm) * PATH_WEIGHT
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
export function prepareSequence(frames, aspect) {
  const vectors = resample(
    frames.map((frame) => frame.t),
    sequenceFeatures(frames, aspect),
  )
  return { vectors, movement: movementOf(vectors) }
}
