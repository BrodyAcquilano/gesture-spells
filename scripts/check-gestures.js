// Checks the gesture maths and the built-in sounds, without a camera:
//   - DTW on hand-worked tiny cases
//   - on a synthetic hand: recording a pinch is trimmed to the movement, and
//     a still hand, a drifting hand, a wave, a fist and a half pinch never cast
//   - the spells' examples, replayed live and unseen: no wrong spell,
//     nothing cast when played backwards, and at least 80% cast
//   - the spark chime, fire crackle and light swell: length, level, fade to silence
// Run with `npm run check`.
import { dtw } from '../src/gestures/dtw.js'
import { buildRecognizer, createLiveMatcher } from '../src/gestures/recognizer.js'
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
    // Jitter about as large as the real tracker's on a still hand.
    return [sx + gaussian() * 0.0008, sy + gaussian() * 0.0012, 0]
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
function runLive(frames, rec = recognizer) {
  const matcher = createLiveMatcher(rec)
  const casts = []
  let closest = Infinity
  for (const frame of frames) {
    const result = matcher.push(frame, 16 / 9)
    if (result?.best) closest = Math.min(closest, result.best.distance)
    if (result?.match) casts.push(frame.t)
  }
  return { casts, closest }
}

// Synthetic live pinches with this file's own hand, shaped differently from
// the generated examples. Reported, not checked: a hint that the generated
// examples carry over to other hands. The spell tests below are the strict ones.
const info = (name, result) =>
  console.log(`info  ${name}: ${result.casts.length ? `cast at ${result.casts.map((t) => t.toFixed(0)).join(', ')} ms` : 'no cast'}, closest ${Number.isFinite(result.closest) ? result.closest.toFixed(3) : '(never counted as a movement)'}`)
info('synthetic live pinch (closes at 1450 ms)', runLive(movement(3000, pinchAt(1200, 250, { scale: 0.95, dx: 0.1, dy: -0.05 }))))
info('synthetic slower pinch', runLive(movement(3000, pinchAt(1000, 450))))
info(
  'synthetic pinch from a curled start',
  runLive(
    movement(3000, (t) => {
      const f = smoothstep((t - 1000) / 300)
      return { fist: 0.5 * (1 - f), pinch: f }
    }),
  ),
)

// Things that must never cast, synthetic or not.
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

// ---------- the spells, with their examples ----------
// Every example is played back as a live stream (held still before and
// after) through the same live matcher as the app, to a recogniser with all
// the spells but without that example, so it has never seen it.
// Checked strictly:
//   - no example casts a different spell
//   - played backwards, no example casts anything
//   - at least 80% of examples cast their own spell
// Reported: which examples were missed, and the same examples started from a
// different position (their first third replaced by their middle pose).
const { readFileSync } = await import('node:fs')
const spellsDir = new URL('../public/library/spells/', import.meta.url)
// Every spell in the spellbook (all spells are files now). A spell needs at
// least two examples to be tested this way, since one is held back.
const allSpells = JSON.parse(readFileSync(new URL('index.json', spellsDir), 'utf8')).map((file) =>
  JSON.parse(readFileSync(new URL(file, spellsDir), 'utf8')),
)
const builtIns = allSpells.filter((spell) => (spell.gesture?.examples?.length ?? 0) >= 2)
for (const spell of allSpells) {
  if (!builtIns.includes(spell)) console.log(`info  ${spell.name}: fewer than 2 examples, not tested`)
}
function stream(frames) {
  const step = 1000 / 30
  const out = []
  let t = 0
  for (let i = 0; i < 30; i++) out.push({ ...frames[0], t: (t += step) })
  const start = t
  for (const frame of frames) out.push({ ...frame, t: start + frame.t })
  t = out[out.length - 1].t
  for (let i = 0; i < 30; i++) out.push({ ...frames[frames.length - 1], t: (t += step) })
  return out
}
function runWith(rec, frames, aspect) {
  const matcher = createLiveMatcher(rec)
  const casts = []
  let closest = Infinity
  for (const frame of frames) {
    const result = matcher.push(frame, aspect)
    if (result?.best) closest = Math.min(closest, result.best.distance)
    if (result?.match) casts.push(result.match.spell.id)
  }
  return { casts, closest }
}
let examplesTried = 0
let examplesCast = 0
for (const spellUnderTest of builtIns) {
  const missed = []
  const otherStart = []
  spellUnderTest.gesture.examples.forEach((example, k) => {
    const rec = buildRecognizer(
      builtIns.map((other) =>
        other === spellUnderTest ? { ...other, gesture: { examples: other.gesture.examples.filter((_, j) => j !== k) } } : other,
      ),
    )
    const label = `${spellUnderTest.name} ${k + 1}`
    const forward = runWith(rec, stream(example.frames), example.aspect)
    const wrong = forward.casts.filter((id) => id !== spellUnderTest.id)
    check(`${label} doesn't cast another spell`, wrong.length === 0, wrong.length ? `cast ${wrong.join(', ')}` : '')
    examplesTried++
    if (forward.casts.includes(spellUnderTest.id)) examplesCast++
    else missed.push(`${k + 1} (closest ${Number.isFinite(forward.closest) ? forward.closest.toFixed(2) : '-'})`)
    const reversed = [...example.frames].reverse().map((frame, i) => ({ ...frame, t: example.frames[i].t }))
    const backward = runWith(rec, stream(reversed), example.aspect)
    check(`${label} played backwards casts nothing`, backward.casts.length === 0, backward.casts.length ? `cast ${backward.casts.join(', ')}` : '')
    const middle = example.frames[Math.floor(example.frames.length / 2)]
    const changedStart = example.frames.map((frame, i) => (i < example.frames.length / 3 ? { ...middle, t: frame.t } : frame))
    const fromMiddle = runWith(rec, stream(changedStart), example.aspect)
    if (fromMiddle.casts.includes(spellUnderTest.id)) otherStart.push(k + 1)
  })
  const own = buildRecognizer(builtIns).entries.find((entry) => entry.spell.id === spellUnderTest.id)
  console.log(
    `info  ${spellUnderTest.name}: limit ${own.threshold.toFixed(2)}; missed ${missed.length ? missed.join(', ') : 'none'}; from another start cast ${otherStart.length}/${spellUnderTest.gesture.examples.length}`,
  )
}
check(
  'at least 80% of examples cast their own spell',
  examplesCast >= examplesTried * 0.8,
  `${examplesCast} of ${examplesTried} (${Math.round((100 * examplesCast) / examplesTried)}%)`,
)

// ---------- spark chime ----------
const { synthesiseSparkChime, renderSparkChime, CHIME_SECONDS, SAMPLE_RATE } = await import('../src/effects/sparkSound.js')
const chime = synthesiseSparkChime()
const chimeLength = chime.left.length
check('chime is 1.8 s long', chimeLength === Math.ceil(CHIME_SECONDS * SAMPLE_RATE), `${(chimeLength / SAMPLE_RATE).toFixed(2)} s`)
let chimePeak = 0
for (let i = 0; i < chimeLength; i++) chimePeak = Math.max(chimePeak, Math.abs(chime.left[i]), Math.abs(chime.right[i]))
check('chime peak is 0.8 (no clipping)', Math.abs(chimePeak - 0.8) < 1e-3, chimePeak.toFixed(3))
check('chime ends in silence', chime.left[chimeLength - 1] === 0 && chime.right[chimeLength - 1] === 0)
// Loudness (root mean square) in 0.3 s slices: loudest near the start, then
// every slice quieter than the one before, still audible at 1.2–1.5 s.
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

// ---------- fire crackle ----------
const { synthesiseFireCrackle, renderFireCrackle, CRACKLE_SECONDS } = await import('../src/effects/fireSound.js')
const fire = synthesiseFireCrackle()
const fireLength = fire.left.length
check('fire crackle is 2.0 s long', fireLength === Math.ceil(CRACKLE_SECONDS * SAMPLE_RATE), `${(fireLength / SAMPLE_RATE).toFixed(2)} s`)
let firePeak = 0
let fireSquares = 0
for (let i = 0; i < fireLength; i++) {
  firePeak = Math.max(firePeak, Math.abs(fire.left[i]), Math.abs(fire.right[i]))
  fireSquares += fire.left[i] ** 2
}
check('fire crackle peak is 0.85 (no clipping)', Math.abs(firePeak - 0.85) < 1e-3, firePeak.toFixed(3))
check('fire crackle ends in silence', fire.left[fireLength - 1] === 0 && fire.right[fireLength - 1] === 0)
// Crackles are sharp peaks well above the average level.
const crest = firePeak / Math.sqrt(fireSquares / fireLength)
check('fire crackle has crackles (peaks far above the average)', crest > 4, `peak/average ${crest.toFixed(1)}`)
const fireSlices = []
for (let s0 = 0; s0 + 0.2 <= CRACKLE_SECONDS + 1e-9; s0 += 0.2) {
  let sum = 0
  const from = Math.round(s0 * SAMPLE_RATE)
  const to = Math.round((s0 + 0.2) * SAMPLE_RATE)
  for (let i = from; i < to; i++) sum += fire.left[i] ** 2 + fire.right[i] ** 2
  fireSlices.push(Math.sqrt(sum / (2 * (to - from))))
}
const fireLoudest = fireSlices.indexOf(Math.max(...fireSlices))
check(
  'fire crackle builds to the burst (0.6–1.2 s), then dies away',
  fireLoudest >= 3 && fireLoudest <= 5 && fireSlices[fireSlices.length - 1] < fireSlices[fireLoudest] * 0.1,
  `loudness per 0.2 s: ${fireSlices.map((v) => v.toFixed(3)).join(' ')}`,
)
const fireWav = await renderFireCrackle()
check('fire crackle WAV has header + 16-bit stereo samples', fireWav.blob.size === 44 + fireLength * 4, `${fireWav.blob.size} bytes`)

// ---------- light swell ----------
const { synthesiseLightSwell, renderLightSwell, LIGHT_SECONDS } = await import('../src/effects/lightSound.js')
const light = synthesiseLightSwell()
const lightLength = light.left.length
check('light swell is 3.3 s long', lightLength === Math.ceil(LIGHT_SECONDS * SAMPLE_RATE), `${(lightLength / SAMPLE_RATE).toFixed(2)} s`)
let lightPeak = 0
for (let i = 0; i < lightLength; i++) lightPeak = Math.max(lightPeak, Math.abs(light.left[i]), Math.abs(light.right[i]))
check('light swell peak is 0.8 (no clipping)', Math.abs(lightPeak - 0.8) < 1e-3, lightPeak.toFixed(3))
check('light swell ends in silence', light.left[lightLength - 1] === 0 && light.right[lightLength - 1] === 0)
const lightSlices = []
for (let s0 = 0; s0 + 0.3 <= LIGHT_SECONDS + 1e-9; s0 += 0.3) {
  let sum = 0
  const from = Math.round(s0 * SAMPLE_RATE)
  const to = Math.round((s0 + 0.3) * SAMPLE_RATE)
  for (let i = from; i < to; i++) sum += light.left[i] ** 2 + light.right[i] ** 2
  lightSlices.push(Math.sqrt(sum / (2 * (to - from))))
}
// It should hold while the light shines (1.8–2.1 s still at least half the
// level of the ping at the start), then fade.
check(
  'light swell holds while the light shines, then fades',
  lightSlices[6] > lightSlices[0] * 0.5 && lightSlices[lightSlices.length - 1] < lightSlices[6] * 0.1,
  `loudness per 0.3 s: ${lightSlices.map((v) => v.toFixed(3)).join(' ')}`,
)
const lightWav = await renderLightSwell()
check('light swell WAV has header + 16-bit stereo samples', lightWav.blob.size === 44 + lightLength * 4, `${lightWav.blob.size} bytes`)

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
