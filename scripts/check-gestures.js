// Checks the gesture maths on synthetic hands, without a camera:
//   - DTW on hand-worked tiny cases
//   - recording a pinch is trimmed to the movement
//   - a live pinch is recognised, once, close to when it closes
//   - a still hand, a drifting hand, a wave and a fist are not
// Run with `npm run check`.
import { dtw } from '../src/gestures/dtw.js'
import { buildRecognizer } from '../src/gestures/recognizer.js'
import { trimRecording } from '../src/gestures/trim.js'

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

// ---------- DTW on small cases worked out by hand ----------
const v = (...xs) => xs.map((x) => [x])
check('dtw of identical sequences is 0', dtw(v(0, 1, 2), v(0, 1, 2)) === 0)
// [0,1,2] vs [0,0,1,2]: the extra 0 pairs with 0 for free, so still 0.
check('dtw ignores a repeated frame', dtw(v(0, 1, 2), v(0, 0, 1, 2)) === 0)
// [0,1] vs [0,3]: best path pairs (0,0) and (1,3): cost 0 + 2 = 2, over n+m = 4.
check('dtw [0,1] vs [0,3] = 0.5', Math.abs(dtw(v(0, 1), v(0, 3)) - 0.5) < 1e-12, dtw(v(0, 1), v(0, 3)))

// ---------- a synthetic hand ----------
// Seeded random numbers, so the check gives the same result every run.
let seed = 42
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
function gaussian() {
  return Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random())
}

// A relaxed open right hand, palm to the camera, in frame fractions (16:9).
const OPEN = [
  [0.5, 0.8], [0.47, 0.76], [0.45, 0.71], [0.435, 0.665], [0.425, 0.63],
  [0.48, 0.65], [0.477, 0.58], [0.475, 0.535], [0.472, 0.495],
  [0.5, 0.64], [0.5, 0.565], [0.5, 0.515], [0.5, 0.475],
  [0.52, 0.65], [0.523, 0.58], [0.525, 0.535], [0.528, 0.5],
  [0.54, 0.67], [0.545, 0.62], [0.55, 0.585], [0.553, 0.555],
]
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lerp = (a, b, f) => a + (b - a) * f

// pinch 0..1 brings thumb and index tips together; fist 0..1 curls every finger.
function pose({ pinch = 0, fist = 0, dx = 0, dy = 0, scale = 1 }) {
  const meet = [(OPEN[4][0] + OPEN[8][0]) / 2, (OPEN[4][1] + OPEN[8][1]) / 2 + 0.03]
  return OPEN.map(([x, y], i) => {
    let px = x
    let py = y
    if (i === 3 || i === 4 || i === 7 || i === 8) {
      const amount = i === 4 || i === 8 ? pinch : pinch * 0.5
      px = lerp(px, meet[0], amount)
      py = lerp(py, meet[1], amount)
    }
    if (fist > 0 && i > 4 && i % 4 !== 1) {
      // fold fingertips and middle joints down towards the palm
      px = lerp(px, 0.5, fist * 0.6)
      py = lerp(py, 0.68, fist * 0.85)
    }
    const sx = 0.5 + (px - 0.5) * scale + dx
    const sy = 0.7 + (py - 0.7) * scale + dy
    return [sx + gaussian() * 0.002, sy + gaussian() * 0.003, 0]
  })
}

// Frames at 30 fps from a function of time (ms) to pose options.
function movement(durationMs, at, start = 0, fps = 30) {
  const frames = []
  for (let t = 0; t <= durationMs; t += 1000 / fps) {
    frames.push({ t: start + t, label: 'Right', points: pose(at(t)) })
  }
  return frames
}

// A pinch: still, close over `close` ms, then hold.
function pinchAt(stillMs, closeMs, extra = {}) {
  return (t) => ({ pinch: smoothstep((t - stillMs) / closeMs), ...extra })
}

// ---------- recording examples ----------
const examples = []
for (const [close, scale, dx] of [
  [220, 1, 0],
  [300, 0.85, 0.05],
  [260, 1.15, -0.04],
]) {
  const frames = movement(2500, pinchAt(700, close, { scale, dx }))
  const result = trimRecording(frames, 16 / 9, 0)
  check(`trim pinch example (close ${close} ms)`, !result.error, result.error ?? `kept ${result.example.duration.toFixed(0)} ms of 2500`)
  if (result.example) examples.push(result.example)
}
const still = trimRecording(movement(2500, () => ({})), 16 / 9, 0)
check('trim rejects a still hand', Boolean(still.error))

const spell = { id: 'pinch', name: 'Pinch', gesture: { examples } }
const recognizer = buildRecognizer([spell])
const entry = recognizer.entries[0]
console.log(`      threshold from the examples: ${entry.threshold.toFixed(3)}`)

// ---------- live streams ----------
// Feeds a stream frame by frame, classifying every second frame like the app
// (with a 1 s cooldown after a cast), and reports casts and closest distances.
function runLive(frames) {
  const history = []
  const casts = []
  let closest = Infinity
  let cooldown = 0
  frames.forEach((frame, i) => {
    history.push(frame)
    while (history.length && history[0].t < frame.t - 4000) history.shift()
    if (i % 2 || frame.t < cooldown) return
    const { best, match } = recognizer.classify(history, frame.t, 16 / 9)
    if (best) closest = Math.min(closest, best.distance)
    if (match) {
      casts.push(frame.t)
      cooldown = frame.t + 1000
      history.length = 0
    }
  })
  return { casts, closest }
}

const livePinch = runLive(movement(3000, pinchAt(1200, 250, { scale: 0.95, dx: 0.1, dy: -0.05 })))
const closesAt = 1200 + 250
check(
  'live pinch casts exactly once',
  livePinch.casts.length === 1,
  `casts at ${livePinch.casts.map((t) => t.toFixed(0)).join(', ') || 'none'} ms, pinch closed at ${closesAt} ms, closest ${livePinch.closest.toFixed(3)}`,
)
check('live pinch casts within 300 ms of closing', livePinch.casts.length > 0 && Math.abs(livePinch.casts[0] - closesAt) < 300)

const slowPinch = runLive(movement(3000, pinchAt(1000, 450)))
check('slower live pinch still casts', slowPinch.casts.length === 1, `closest ${slowPinch.closest.toFixed(3)}`)

const negatives = {
  'still hand': () => ({}),
  'hand drifting across': (t) => ({ dx: -0.2 + t / 10000, dy: Math.sin(t / 600) * 0.05 }),
  'waving side to side': (t) => ({ dx: Math.sin(t / 150) * 0.12 }),
  'closing into a fist': (t) => ({ fist: smoothstep((t - 1000) / 300) }),
  'half pinch (fingers stop apart)': (t) => ({ pinch: 0.45 * smoothstep((t - 1000) / 250) }),
}
for (const [name, at] of Object.entries(negatives)) {
  const result = runLive(movement(4000, at))
  check(`no cast: ${name}`, result.casts.length === 0, `closest ${Number.isFinite(result.closest) ? result.closest.toFixed(3) : 'skipped (too little movement)'}`)
}

// ---------- the packaged Pinch spark spell (real recordings) ----------
// Each recorded example is played back as a live stream (held still before
// and after) to a recogniser built from the *other* examples, so it has never
// seen it. It should cast. The same movement played backwards (releasing a
// pinch) should not.
const { readFileSync } = await import('node:fs')
const packaged = JSON.parse(readFileSync(new URL('../public/library/spells/pinch-spark.json', import.meta.url), 'utf8'))
const realExamples = packaged.gesture.examples
function stream(frames, aspect) {
  const step = 1000 / 30
  const out = []
  let t = 0
  for (let i = 0; i < 30; i++) out.push({ ...frames[0], t: (t += step) })
  const start = t
  for (const frame of frames) out.push({ ...frame, t: start + frame.t })
  t = out[out.length - 1].t
  for (let i = 0; i < 30; i++) out.push({ ...frames[frames.length - 1], t: (t += step) })
  return { frames: out, aspect }
}
function runWith(rec, { frames, aspect }) {
  const history = []
  let casts = 0
  let closest = Infinity
  let cooldown = 0
  frames.forEach((frame, i) => {
    history.push(frame)
    if (i % 2 || frame.t < cooldown) return
    const { best, match } = rec.classify(history, frame.t, aspect)
    if (best) closest = Math.min(closest, best.distance)
    if (match) {
      casts++
      cooldown = frame.t + 1000
      history.length = 0
    }
  })
  return { casts, closest }
}
realExamples.forEach((example, k) => {
  const others = realExamples.filter((_, j) => j !== k)
  const rec = buildRecognizer([{ ...packaged, gesture: { examples: others } }])
  const threshold = rec.entries[0].threshold
  const forward = runWith(rec, stream(example.frames, example.aspect))
  const reversed = [...example.frames].reverse().map((frame, i) => ({ ...frame, t: example.frames[i].t }))
  const backward = runWith(rec, stream(reversed, example.aspect))
  check(`real pinch ${k + 1} casts (unseen)`, forward.casts === 1, `closest ${forward.closest.toFixed(3)} / limit ${threshold.toFixed(3)}`)
  check(`real pinch ${k + 1} released (reversed) does not cast`, backward.casts === 0, `closest ${Number.isFinite(backward.closest) ? backward.closest.toFixed(3) : 'skipped'}`)
})

// ---------- spark chime ----------
const { synthesiseSparkChime, renderSparkChime, CHIME_SECONDS, SAMPLE_RATE } = await import('../src/effects/sparkSound.js')
const chime = synthesiseSparkChime()
const chimeLength = chime.left.length
check('chime is 1.8 s long', chimeLength === Math.ceil(CHIME_SECONDS * SAMPLE_RATE), `${(chimeLength / SAMPLE_RATE).toFixed(2)} s`)
let chimePeak = 0
for (let i = 0; i < chimeLength; i++) chimePeak = Math.max(chimePeak, Math.abs(chime.left[i]), Math.abs(chime.right[i]))
check('chime peak is 0.8 (no clipping)', Math.abs(chimePeak - 0.8) < 1e-3, chimePeak.toFixed(3))
check('chime ends in silence', chime.left[chimeLength - 1] === 0 && chime.right[chimeLength - 1] === 0)
// Loudness (root mean square) in 0.3 s slices: it builds while the bells
// ripple upwards, then every slice after the loudest is quieter, while the
// sparks are still flying (to 1.5 s) it should still be clearly audible.
const slices = []
for (let s = 0; s + 0.3 <= CHIME_SECONDS + 1e-9; s += 0.3) {
  let sum = 0
  const from = Math.round(s * SAMPLE_RATE)
  const to = Math.round((s + 0.3) * SAMPLE_RATE)
  for (let i = from; i < to; i++) sum += chime.left[i] ** 2 + chime.right[i] ** 2
  slices.push(Math.sqrt(sum / (2 * (to - from))))
}
const loudest = slices.indexOf(Math.max(...slices))
const fading = loudest <= 2 && slices.slice(loudest + 1).every((value, i) => value < slices[loudest + i]) && slices[4] > 0.02
check('chime fades out over time', fading, `loudness per 0.3 s: ${slices.map((v) => v.toFixed(3)).join(' ')}`)
const { blob } = await renderSparkChime()
check('chime WAV has header + 16-bit stereo samples', blob.size === 44 + chimeLength * 4, `${blob.size} bytes`)

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
