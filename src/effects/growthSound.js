// "Growth": wood creaking and cracking as a branch grows, softening into a
// gentle rustle as the leaves open (3.6 s). Timed with the Sprout animation:
// the creaking is loudest while the branch grows (0–1.7 s).
//
// Computed sample by sample like the other built-in sounds (see
// sparkSound.js) and saved as a WAV file.
//
// Layers:
//   creak   wood creaks because it sticks and slips: a train of tiny clicks
//           whose rate wanders between about 25 and 110 a second, sent
//           through a few resonant filters (the "body" of the wood). The
//           wandering rate is what makes it groan rather than buzz.
//   cracks  short, sharp bursts of noise through a higher filter, at a few
//           moments while the branch grows: fibres snapping
//   rustle  soft filtered noise, swelling as the leaves unfold
import { encodeWav } from './wav.js'

export const GROWTH_SECONDS = 3.6
export const SAMPLE_RATE = 44100
const FADE_SECONDS = 0.4
const BRANCH_UNTIL = 1.7
export const CREAK_GAIN = 10 // the clicks through narrow filters come out quiet; this brings the creak up to the cracks

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// A two-pole resonant band-pass filter, run sample by sample.
function bandPass(frequency, q) {
  const w = (2 * Math.PI * frequency) / SAMPLE_RATE
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return (x) => {
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

// How loud the creaking is over time: swells in, strongest while the branch
// grows, then dies down as the leaves open.
export function creakLevel(t) {
  if (t < 0.15) return t / 0.15
  if (t < BRANCH_UNTIL) return 1
  return Math.max(0, 1 - (t - BRANCH_UNTIL) / 1.2) * 0.9 + 0.1 * Math.exp(-(t - BRANCH_UNTIL) / 0.5)
}

function rustleLevel(t) {
  if (t < 1.8) return 0
  if (t < 3.0) return Math.sin((Math.PI * (t - 1.8)) / 2.4)
  return Math.max(0, Math.sin((Math.PI * (t - 1.8)) / 2.4))
}

export function synthesiseGrowth() {
  const length = Math.ceil(GROWTH_SECONDS * SAMPLE_RATE)
  const random = seededRandom(77)
  const left = new Float32Array(length)
  const right = new Float32Array(length)

  // Creak: clicks at a wandering rate through three wood resonances.
  const bodies = [bandPass(310, 6), bandPass(620, 8), bandPass(1180, 10)]
  let phase = 0
  let rate = 50
  let target = 50
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    if (random() < 6 / SAMPLE_RATE) target = 25 + random() * 85 // a new wander every ~0.17 s
    rate += (target - rate) * 0.0004
    phase += rate / SAMPLE_RATE
    let click = 0
    if (phase >= 1) {
      phase -= 1
      click = 0.6 + random() * 0.8
    }
    const level = creakLevel(t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 1.3 * t))
    const value = CREAK_GAIN * level * (2.2 * bodies[0](click) + 1.4 * bodies[1](click) + 0.8 * bodies[2](click))
    left[i] += value
    right[i] += value * 0.85
  }

  // Cracks: five, spread over the branch's growth.
  for (const at of [0.25, 0.6, 0.85, 1.2, 1.55]) {
    const start = Math.round((at + random() * 0.08) * SAMPLE_RATE)
    const filter = bandPass(1800 + random() * 1500, 2)
    const level = 0.8 + random() * 0.6
    const pan = random() * 1.2 - 0.6
    const samples = Math.round(0.06 * SAMPLE_RATE)
    for (let k = 0; k < samples && start + k < length; k++) {
      const s = k / SAMPLE_RATE
      // Two or three quick snaps in a row, like fibres giving way.
      const snaps = Math.exp(-s / 0.006) + 0.6 * Math.exp(-Math.max(0, s - 0.018) / 0.005) * (s > 0.018 ? 1 : 0)
      const value = filter((random() * 2 - 1) * snaps) * level
      left[start + k] += value * (1 - pan) * 0.7
      right[start + k] += value * (1 + pan) * 0.7
    }
  }

  // Rustle: airy filtered noise as the leaves open.
  const rustles = [bandPass(3500, 1.2), bandPass(3900, 1.2)]
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const flutter = 0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t + Math.sin(2 * Math.PI * 1.7 * t))
    const level = 0.06 * rustleLevel(t) * flutter
    left[i] += level * rustles[0](random() * 2 - 1)
    right[i] += level * rustles[1](random() * 2 - 1)
  }

  // Normalise to a comfortable peak, then fade the end to exact silence.
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const gain = peak > 0 ? 0.8 / peak : 1
  const fadeStart = length - Math.round(FADE_SECONDS * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    const fade = i < fadeStart ? 1 : 1 - (i - fadeStart) / (length - 1 - fadeStart)
    left[i] *= gain * fade
    right[i] *= gain * fade
  }
  return { left, right }
}

export async function renderGrowth() {
  const { left, right } = synthesiseGrowth()
  return { blob: encodeWav([left, right], SAMPLE_RATE), duration: GROWTH_SECONDS }
}
