// "Fire crackle": the whoosh of a fireball forming, a roar while it flies, and
// crackles and pops throughout, about as long as the fireball (2 s), fading
// to silence.
//
// Computed sample by sample like the spark chime (see sparkSound.js) and saved
// as a WAV file.
//
// Layers:
//   roar      random noise through a low-pass filter: the deep rumble of flame
//   whoosh    noise through a band-pass filter whose centre sweeps upwards
//             as the ball grows, so it rushes towards you
//   crackles  hundreds of tiny clicks, each a few milliseconds of noise that
//             dies away fast, at random times and loudness, panned left or
//             right; more of them while the fire is biggest. A few larger,
//             duller "pops" for burning wood.
import { encodeWav } from './wav.js'

export const CRACKLE_SECONDS = 2.0
export const SAMPLE_RATE = 44100
const FADE_SECONDS = 0.5

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// How big the fire is over time (0 to 1): grows over 0.9 s, bursts, dies.
function fireLevel(t) {
  if (t < 0.9) return 0.25 + 0.75 * (t / 0.9) ** 1.5
  return Math.exp(-(t - 0.9) / 0.45)
}

export function synthesiseFireCrackle() {
  const length = Math.ceil(CRACKLE_SECONDS * SAMPLE_RATE)
  const random = seededRandom(11)
  const left = new Float32Array(length)
  const right = new Float32Array(length)

  // Roar and whoosh.
  let low = 0
  let bandLow = 0
  let bandHigh = 0
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const noise = random() * 2 - 1
    low += 0.03 * (noise - low) // one-pole low-pass, around 200 Hz
    // A crude band-pass: the difference of two low-passes at different speeds.
    const centre = 300 + 1800 * Math.min(1, t / 0.9)
    const fast = Math.min(0.9, (2 * Math.PI * centre * 1.6) / SAMPLE_RATE)
    const slow = Math.min(0.9, (2 * Math.PI * centre * 0.6) / SAMPLE_RATE)
    bandHigh += fast * (noise - bandHigh)
    bandLow += slow * (noise - bandLow)
    const level = fireLevel(t)
    const roar = low * 3.2 * level
    const whoosh = (bandHigh - bandLow) * 0.9 * level * (t < 1.1 ? 1 : Math.exp(-(t - 1.1) / 0.2))
    left[i] += roar + whoosh
    right[i] += roar + whoosh
  }

  // Crackles: about 90 a second at the fire's biggest.
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    if (random() > (90 * fireLevel(t)) / SAMPLE_RATE) continue
    const pop = random() < 0.08
    const decay = pop ? 0.006 + random() * 0.006 : 0.0006 + random() * 0.0015 // seconds
    const loudness = 0.5 * ((pop ? 0.6 : 0.25) + random() ** 2 * (pop ? 0.6 : 0.9))
    const pan = random() * 1.6 - 0.8
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4)
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4)
    let previous = 0
    let smooth = 0
    const samples = Math.min(length - i, Math.ceil(decay * 6 * SAMPLE_RATE))
    for (let k = 0; k < samples; k++) {
      const noise = random() * 2 - 1
      // Clicks are bright (high-passed noise); pops are duller (low-passed).
      let value
      if (pop) {
        smooth += 0.25 * (noise - smooth)
        value = smooth
      } else {
        value = noise - previous
        previous = noise
      }
      value *= loudness * Math.exp(-k / (decay * SAMPLE_RATE))
      left[i + k] += value * leftGain
      right[i + k] += value * rightGain
    }
  }

  // Normalise to a comfortable peak, then fade the end to exact silence.
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const scale = peak > 0 ? 0.85 / peak : 1
  const fadeStart = length - Math.round(FADE_SECONDS * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    const fade = i < fadeStart ? 1 : 1 - (i - fadeStart) / (length - 1 - fadeStart)
    left[i] *= scale * fade
    right[i] *= scale * fade
  }
  return { left, right }
}

export async function renderFireCrackle() {
  const { left, right } = synthesiseFireCrackle()
  return { blob: encodeWav([left, right], SAMPLE_RATE), duration: CRACKLE_SECONDS }
}
