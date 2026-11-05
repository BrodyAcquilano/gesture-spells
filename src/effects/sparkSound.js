// "Spark chime": a magical shimmer about as long as the ✨ burst (1.8 s),
// fading out the same way.
//
// Every sample is computed directly in JavaScript, then saved as a WAV file,
// so the library holds a real audio file that plays in a normal audio player.
// A sound is just a list of numbers between -1 and 1, 44,100 per second for
// each ear.
//
// Layers:
//   bells    nine high notes from a pentatonic scale, rising in a quick ripple.
//            Each is a sine plus a quieter overtone at 2.76× its pitch (the
//            slightly "off" overtone is what makes a bell sound like a bell),
//            placed left or right, with a sharp attack and a long decay.
//   echo     the bells repeat every 0.16 s, each repeat quieter and duller.
//   shimmer  random noise through a band-pass filter around 7 kHz: the
//            sparkly hiss.
//   swell    a soft tone gliding up an octave underneath.
// The last 0.6 s fades to silence.
import { encodeWav } from './wav.js'

export const CHIME_SECONDS = 1.8
export const SAMPLE_RATE = 44100

// A pentatonic scale (no clashing notes) starting at A5 = 880 Hz.
const NOTES = [880, 987.77, 1108.73, 1318.51, 1479.98, 1760, 1975.53, 2217.46, 2637.02]
const ECHO_SECONDS = 0.16
const ECHO_GAIN = 0.38
const ECHO_REPEATS = 6
const FADE_SECONDS = 0.6

// Seeded so the chime sounds the same every time it is made.
function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// One-pole low-pass filter: each output moves part of the way towards the
// input, which smooths away the highest frequencies (a "duller" sound).
function lowPass(samples, amount) {
  const out = new Float32Array(samples.length)
  let y = 0
  for (let i = 0; i < samples.length; i++) {
    y += amount * (samples[i] - y)
    out[i] = y
  }
  return out
}

// Band-pass filter (the standard "biquad" recipe): keeps frequencies near
// `centre` and removes the rest.
function bandPass(samples, centre, q) {
  const w = (2 * Math.PI * centre) / SAMPLE_RATE
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  const out = new Float32Array(samples.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

// Returns { left, right } as Float32Arrays.
export function synthesiseSparkChime() {
  const length = Math.ceil(CHIME_SECONDS * SAMPLE_RATE)
  const random = seededRandom(7)
  const bellsLeft = new Float32Array(length)
  const bellsRight = new Float32Array(length)

  NOTES.forEach((frequency, n) => {
    const start = n * 0.065 + random() * 0.02
    const decay = 0.28 + random() * 0.2 // seconds for the note to fall to about a third
    const pan = random() * 1.6 - 0.8 // -1 left … 1 right
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4)
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4)
    for (let i = Math.floor(start * SAMPLE_RATE); i < length; i++) {
      const t = i / SAMPLE_RATE - start
      const envelope = Math.min(1, t / 0.006) * Math.exp(-t / decay)
      if (envelope < 1e-4 && t > 0.01) break
      const value =
        envelope * (0.11 * Math.sin(2 * Math.PI * frequency * t) + 0.035 * Math.sin(2 * Math.PI * frequency * 2.76 * t))
      bellsLeft[i] += value * leftGain
      bellsRight[i] += value * rightGain
    }
  })

  // Echo: add delayed copies, each quieter and passed through a low-pass again.
  const delay = Math.round(ECHO_SECONDS * SAMPLE_RATE)
  const left = Float32Array.from(bellsLeft)
  const right = Float32Array.from(bellsRight)
  let echoLeft = bellsLeft
  let echoRight = bellsRight
  for (let k = 1; k <= ECHO_REPEATS; k++) {
    echoLeft = lowPass(echoLeft, 0.45)
    echoRight = lowPass(echoRight, 0.45)
    const gain = ECHO_GAIN ** k
    // Alternate sides so the echo bounces left and right.
    const [toLeft, toRight] = k % 2 ? [echoRight, echoLeft] : [echoLeft, echoRight]
    for (let i = k * delay; i < length; i++) {
      left[i] += toLeft[i - k * delay] * gain
      right[i] += toRight[i - k * delay] * gain
    }
  }

  // Shimmer: filtered noise that swells in over 0.12 s and dies away.
  const noise = new Float32Array(length)
  for (let i = 0; i < length; i++) noise[i] = random() * 2 - 1
  const shimmerLeft = bandPass(noise, 7000, 1.5)
  const shimmerRight = bandPass(noise.map(() => random() * 2 - 1), 7500, 1.5)

  // Swell: a triangle wave whose pitch glides from 440 Hz to 880 Hz.
  let phase = 0
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const shimmerLevel = 0.09 * Math.min(1, t / 0.12) * Math.exp(-t / 0.75)
    left[i] += shimmerLeft[i] * shimmerLevel
    right[i] += shimmerRight[i] * shimmerLevel

    const frequency = 440 * 2 ** Math.min(1, t / 0.9)
    phase = (phase + frequency / SAMPLE_RATE) % 1
    const triangle = 4 * Math.abs(phase - 0.5) - 1
    const swellLevel = 0.04 * Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.25) / 0.35)
    left[i] += triangle * swellLevel
    right[i] += triangle * swellLevel
  }

  // Normalise to a comfortable peak, then fade the end to exact silence.
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const scale = peak > 0 ? 0.8 / peak : 1
  const fadeStart = length - Math.round(FADE_SECONDS * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    const fade = i < fadeStart ? 1 : 1 - (i - fadeStart) / (length - 1 - fadeStart)
    left[i] *= scale * fade
    right[i] *= scale * fade
  }
  return { left, right }
}

export async function renderSparkChime() {
  const { left, right } = synthesiseSparkChime()
  return { blob: encodeWav([left, right], SAMPLE_RATE), duration: CHIME_SECONDS }
}
