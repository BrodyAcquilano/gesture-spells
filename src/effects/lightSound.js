// "Light-Swell": the sound of the Illumination: a glassy ping as the light
// flares, then a warm, bright chord that swells and holds while it shines,
// with an airy shimmer and small twinkles, fading out with the light (3.3 s).
//
// Computed sample by sample like the other built-in sounds (see
// sparkSound.js) and saved as a WAV file.
//
// Layers:
//   ping     two high sine notes that start instantly and ring away (the snap
//            of light)
//   chord    C major spread over two octaves (C, E, G, C). Each note is a sine
//            with a little of its octave above for warmth, played slightly
//            out of tune between the left and right ear, which makes it
//            shimmer and sound wide ("chorus")
//   air      noise through a high band-pass filter, gently pulsing
//   twinkles short, very high pings at random times, left and right, like
//            the specks of light drifting away
// Everything follows the light's brightness: full for about 2.2 s, then a fade.
import { encodeWav } from './wav.js'

export const LIGHT_SECONDS = 3.3
export const SAMPLE_RATE = 44100
const FADE_SECONDS = 0.5

const CHORD = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
const DETUNE = 1.5 // Hz between left and right

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// How bright the light is (0 to 1): swells in over 0.15 s, holds, then fades
// from 2.2 s, like the Illumination animation.
function glow(t) {
  if (t < 0.15) return t / 0.15
  if (t < 2.2) return 1 - 0.12 * ((t - 0.15) / 2.05)
  return 0.88 * Math.exp(-(t - 2.2) / 0.35)
}

export function synthesiseLightSwell() {
  const length = Math.ceil(LIGHT_SECONDS * SAMPLE_RATE)
  const random = seededRandom(23)
  const left = new Float32Array(length)
  const right = new Float32Array(length)

  // Air: band-pass filtered noise (a two-pole resonant filter around 8 kHz).
  const w = (2 * Math.PI * 8000) / SAMPLE_RATE
  const q = 2
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  const air = [
    { x1: 0, x2: 0, y1: 0, y2: 0 },
    { x1: 0, x2: 0, y1: 0, y2: 0 },
  ]
  const band = (state, x) => {
    const y = b0 * x + b2 * state.x2 - a1 * state.y1 - a2 * state.y2
    state.x2 = state.x1
    state.x1 = x
    state.y2 = state.y1
    state.y1 = y
    return y
  }

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const g = glow(t)

    // Ping.
    const pingEnvelope = Math.min(1, t / 0.002) * Math.exp(-t / 0.35)
    const ping = pingEnvelope * (0.18 * Math.sin(2 * Math.PI * 3135.96 * t) + 0.1 * Math.sin(2 * Math.PI * 4698.64 * t))

    // Chord.
    let chordLeft = 0
    let chordRight = 0
    CHORD.forEach((f, n) => {
      const level = 0.07 / (1 + n * 0.25)
      chordLeft += level * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t))
      chordRight += level * (Math.sin(2 * Math.PI * (f + DETUNE) * t) + 0.25 * Math.sin(2 * Math.PI * 2 * (f + DETUNE) * t))
    })

    // Air, pulsing gently six times a second.
    const pulse = 0.8 + 0.2 * Math.sin(2 * Math.PI * 6 * t)
    const airLeft = band(air[0], random() * 2 - 1) * 0.12 * pulse
    const airRight = band(air[1], random() * 2 - 1) * 0.12 * pulse

    left[i] += ping + g * (chordLeft + airLeft)
    right[i] += ping + g * (chordRight + airRight)
  }

  // Twinkles: about six a second while the light shines.
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    if (random() > (6 * glow(t)) / SAMPLE_RATE || t < 0.2) continue
    const frequency = 2500 + random() * 3000
    const level = 0.04 + random() * 0.05
    const pan = random() * 1.6 - 0.8
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4)
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4)
    const samples = Math.min(length - i, Math.round(0.4 * SAMPLE_RATE))
    for (let k = 0; k < samples; k++) {
      const s = k / SAMPLE_RATE
      const value = level * Math.min(1, s / 0.002) * Math.exp(-s / 0.08) * Math.sin(2 * Math.PI * frequency * s)
      left[i + k] += value * leftGain
      right[i + k] += value * rightGain
    }
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

export async function renderLightSwell() {
  const { left, right } = synthesiseLightSwell()
  return { blob: encodeWav([left, right], SAMPLE_RATE), duration: LIGHT_SECONDS }
}
