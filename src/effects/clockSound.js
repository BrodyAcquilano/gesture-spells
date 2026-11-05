// "Clock-Tick": a clock ticking fast, then slowing tick by tick until it
// stops, with a low bell at the end (4.2 s). The ticks fall at the same
// moments the Clock animation's second hand jumps (clockTiming.js).
//
// Computed sample by sample like the other built-in sounds (see
// sparkSound.js) and saved as a WAV file.
//
// Layers:
//   ticks  each one a sharp click of noise (the escapement) plus two short
//          ringing tones (the clock's body), alternating a higher "tick" and
//          a lower "tock", a little left and right. As the clock slows, every
//          tick is pitched lower and rings longer, like a tape slowing down.
//   drone  a quiet low tone that slides down an octave: time stretching
//   bell   a soft low bell on the last tick, as the clock stops
import { encodeWav } from './wav.js'
import { LAST_TICK_BY, tickTimes } from './clockTiming.js'

export const CLOCK_SECONDS = 4.2
export const SAMPLE_RATE = 44100
const FADE_SECONDS = 0.3

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function synthesiseClockTick() {
  const length = Math.ceil(CLOCK_SECONDS * SAMPLE_RATE)
  const random = seededRandom(61)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  const ticks = tickTimes()

  ticks.forEach((start, n) => {
    const slow = start / LAST_TICK_BY // 0 at the start, 1 at the last tick
    const pitch = 1 - 0.4 * slow
    const ring = 0.018 + 0.03 * slow // seconds the body rings
    const tock = n % 2 === 1
    const body = (tock ? 1500 : 2100) * pitch
    const low = (tock ? 520 : 700) * pitch
    const pan = tock ? 0.25 : -0.25
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4)
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4)
    const level = 0.8 + 0.2 * slow
    const first = Math.round(start * SAMPLE_RATE)
    const samples = Math.min(length - first, Math.round(0.25 * SAMPLE_RATE))
    let previous = 0
    for (let k = 0; k < samples; k++) {
      const s = k / SAMPLE_RATE
      // Click: noise, made brighter by taking the difference of neighbours.
      const noise = random() * 2 - 1
      const click = (noise - previous) * 0.5 * Math.exp(-s / 0.0015)
      previous = noise
      const tone =
        0.45 * Math.sin(2 * Math.PI * body * s) * Math.exp(-s / ring) +
        0.35 * Math.sin(2 * Math.PI * low * s) * Math.exp(-s / (ring * 1.6))
      const value = level * Math.min(1, s / 0.0005) * (click + tone)
      left[first + k] += value * leftGain
      right[first + k] += value * rightGain
    }
  })

  const lastTick = ticks[ticks.length - 1]
  let phase = 0
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    // Drone: 196 Hz sliding down to 98 Hz, swelling in and out.
    const progress = Math.min(1, t / (lastTick + 0.3))
    phase += (2 * Math.PI * 196 * 2 ** -progress) / SAMPLE_RATE
    const droneLevel = 0.06 * Math.sin(Math.PI * Math.min(1, t / (lastTick + 0.6)))
    const drone = droneLevel * (Math.sin(phase) + 0.3 * Math.sin(2 * phase))
    // Bell on the last tick: a low note with a few inharmonic partials.
    let bell = 0
    if (t >= lastTick) {
      const s = t - lastTick
      for (const [ratio, level, decay] of [
        [1, 0.3, 0.6],
        [2.76, 0.12, 0.35],
        [5.4, 0.06, 0.2],
      ]) {
        bell += level * Math.sin(2 * Math.PI * 130.8 * ratio * s) * Math.exp(-s / decay) * Math.min(1, s / 0.003)
      }
    }
    left[i] += drone + bell
    right[i] += drone * 0.9 + bell
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
  return { left, right, ticks }
}

export async function renderClockTick() {
  const { left, right } = synthesiseClockTick()
  return { blob: encodeWav([left, right], SAMPLE_RATE), duration: CLOCK_SECONDS }
}
