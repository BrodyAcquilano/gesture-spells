// "Growth": wood creaking and cracking as a branch grows, softening into a
// gentle rustle as the leaves open (3.6 s). Timed with the Sprout animation:
// the creaking is loudest while the branch grows (0–1.7 s).
//
// Computed sample by sample like the other built-in sounds (see
// sparkSound.js) and saved as a WAV file.
//
// Layers:
//   creaks  wood creaks because its fibres stick and slip: each slip is a
//           tiny scrape. A creak is a run of these, slow at first (single
//           ticks you can hear apart), speeding up and slowing again like a
//           door or a bending branch, never perfectly even. The scrapes ring
//           through a few low, uneven resonances (the wood's body) and a
//           deep groan. Creaks come one at a time with gaps, not as a steady
//           buzz: an even, continuous buzz is what sounds like plastic.
//   cracks  dry fibres snapping: a quick cluster of sharp clicks with a dull
//           knock under the first
//   rustle  soft filtered noise, swelling as the leaves unfold
//   room    two faint, short echoes, so it sounds like a solid thing in a
//           space rather than a thin sound in your ear
import { encodeWav } from './wav.js'

export const GROWTH_SECONDS = 3.6
export const SAMPLE_RATE = 44100
const FADE_SECONDS = 0.4

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

// The creaks: [start (s), length (s), slowest and fastest slips a second,
// loudness]. Four strong ones while the branch grows, two soft ones as the
// sprout opens.
const CREAKS = [
  [0.05, 0.45, 9, 38, 1],
  [0.55, 0.38, 14, 55, 0.85],
  [0.98, 0.5, 8, 30, 1],
  [1.38, 0.34, 12, 48, 0.8],
  [1.95, 0.4, 7, 22, 0.35],
  [2.55, 0.28, 10, 26, 0.2],
]
// The wood's body: resonances (Hz), how sharp, how loud.
const BODY = [
  [140, 7, 0.9], // the deep groan
  [260, 4, 1],
  [545, 5, 0.75],
  [1010, 6, 0.45],
  [1870, 5, 0.25],
]
const CRACKS = [0.32, 0.78, 1.18, 1.52]
const CREAK_GAIN = 9 // scrapes through narrow resonances come out quiet; this sets the creaks just under the cracks

export function synthesiseGrowth() {
  const length = Math.ceil(GROWTH_SECONDS * SAMPLE_RATE)
  const random = seededRandom(77)
  const dry = [new Float32Array(length), new Float32Array(length)]

  // Creaks.
  for (const [start, duration, slow, fast, loudness] of CREAKS) {
    const shift = 0.9 + random() * 0.2 // each creak in a slightly different place in the wood
    const body = BODY.map(([f, q, g]) => ({ filter: bandPass(f * shift, q), gain: g }))
    const pan = random() * 0.8 - 0.4
    const first = Math.round(start * SAMPLE_RATE)
    const count = Math.round(duration * SAMPLE_RATE)
    const excitation = new Float32Array(count)
    // Place the slips: slow, faster in the middle, slow again, uneven.
    let at = 0
    while (at < duration) {
      const f = at / duration
      const rate = slow + (fast - slow) * Math.sin(Math.PI * f)
      const strength = (0.5 + random() * 0.5) * Math.sin(Math.PI * f) ** 0.6
      const index = Math.round(at * SAMPLE_RATE)
      // A slip: a tiny scrape of noise, about 2 ms.
      for (let k = 0; k < 90 && index + k < count; k++) excitation[index + k] += strength * (random() * 2 - 1) * Math.exp(-k / 25)
      at += (1 / rate) * (0.75 + random() * 0.5)
    }
    for (let k = 0; k < count + 4000 && first + k < length; k++) {
      const x = k < count ? excitation[k] : 0
      let value = 0
      for (const { filter, gain } of body) value += gain * filter(x)
      value *= loudness * CREAK_GAIN
      dry[0][first + k] += value * (1 - pan)
      dry[1][first + k] += value * (1 + pan)
    }
  }

  // Cracks: a cluster of 3–5 sharp clicks within about 40 ms, with a dull
  // knock under the first.
  for (const crackAt of CRACKS) {
    const first = Math.round((crackAt + random() * 0.05) * SAMPLE_RATE)
    const sharp = bandPass(2600 + random() * 2000, 1.4)
    const knock = bandPass(170 + random() * 60, 2.5)
    const clicks = 3 + Math.floor(random() * 3)
    const times = Array.from({ length: clicks }, (_, i) => (i === 0 ? 0 : Math.round(random() * 0.04 * SAMPLE_RATE))).sort((a, b) => a - b)
    const pan = random() * 1.2 - 0.6
    const span = Math.round(0.12 * SAMPLE_RATE)
    const excitation = new Float32Array(span)
    times.forEach((time, i) => {
      const level = i === 0 ? 1 : 0.3 + random() * 0.5
      for (let k = 0; k < 40 && time + k < span; k++) excitation[time + k] += level * (random() * 2 - 1) * Math.exp(-k / 8)
    })
    for (let k = 0; k < span && first + k < length; k++) {
      const knockIn = k < 30 ? (random() * 2 - 1) * Math.exp(-k / 10) : 0
      const value = 1.1 * sharp(excitation[k]) + 1.5 * knock(knockIn)
      dry[0][first + k] += value * (1 - pan)
      dry[1][first + k] += value * (1 + pan)
    }
  }

  // Rustle: airy filtered noise as the leaves open.
  const rustles = [bandPass(3500, 1.2), bandPass(3900, 1.2)]
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const swell = t < 1.8 ? 0 : Math.max(0, Math.sin((Math.PI * (t - 1.8)) / 2.4))
    const flutter = 0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t + Math.sin(2 * Math.PI * 1.7 * t))
    const level = 0.05 * swell * flutter
    dry[0][i] += level * rustles[0](random() * 2 - 1)
    dry[1][i] += level * rustles[1](random() * 2 - 1)
  }

  // Room: two faint short echoes.
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  const echoes = [
    [Math.round(0.023 * SAMPLE_RATE), 0.22],
    [Math.round(0.041 * SAMPLE_RATE), 0.12],
  ]
  for (let i = 0; i < length; i++) {
    let l = dry[0][i]
    let r = dry[1][i]
    for (const [delay, gain] of echoes) {
      if (i >= delay) {
        l += gain * dry[1][i - delay]
        r += gain * dry[0][i - delay]
      }
    }
    left[i] = l
    right[i] = r
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
