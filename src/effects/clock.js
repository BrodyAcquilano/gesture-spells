// "Clock": a gothic clock face appears above the middle fingertip. Its hands
// spin fast, then slow down tick by tick until they stop, as if time were
// winding down (about 4.4 s in all). It follows the fingertip (setPosition).
//
// Drawn as:
//   face     a dark glass disc in a brass ring, 60 minute lines (every fifth
//            longer), Roman numerals I–XII turned towards the centre, and a
//            faint cyan glow. Drawn once into a sprite.
//   hands    hour and minute hands in a gothic style (a pointed spade tip, an
//            open ring and a crossbar on the shaft, a round counterweight),
//            drawn once into sprites, then turned each frame. A thin second
//            hand jumps one numeral at every tick of the Clock-Tick sound.
//   blur     while the hands are fast, a few fainter copies behind them
//   ripples  slow rings spreading from the clock, like time bending
// Only sprites are stamped each frame (no per-frame shadows or text), so it
// stays cheap.
import { tickTimes } from './clockTiming.js'

const APPEAR = 0.3 // seconds to grow in
const STOP_HOLD = 0.35 // after the last tick, before fading
const FADE = 0.6
const TICKS = tickTimes()
const LAST_TICK = TICKS[TICKS.length - 1]
const END = LAST_TICK + STOP_HOLD + FADE
const STEP = Math.PI / 6 // the second hand jumps one numeral per tick
const JUMP = 0.035 // seconds a jump takes

const BRASS_LIGHT = '#f6d68a'
const BRASS = '#c9a24a'
const BRASS_DARK = '#6b4e1c'

// How far the second hand has turned at time t, in jumps (whole numbers
// between ticks, easing quickly through each jump).
function jumpsAt(t) {
  let k = 0
  while (k + 1 < TICKS.length && TICKS[k + 1] <= t) k++
  if (t < TICKS[0]) return 0
  const into = Math.min(1, (t - TICKS[k]) / JUMP)
  return k + 1 - (1 - into) ** 2
}

// The same, but smooth between ticks (for the minute and hour hands, which
// glide).
function glideAt(t) {
  if (t >= LAST_TICK) return TICKS.length
  let k = 0
  while (k + 1 < TICKS.length && TICKS[k + 1] <= t) k++
  const next = TICKS[k + 1] ?? LAST_TICK
  return k + (t - TICKS[k]) / Math.max(1e-6, next - TICKS[k])
}

function sprite(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.ceil(size)
  draw(canvas.getContext('2d'), canvas.width)
  return canvas
}

function drawFace(r) {
  const pad = r * 0.25
  return sprite(2 * (r + pad), (ctx, s) => {
    const c = s / 2
    ctx.translate(c, c)
    // Glow.
    const glow = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r + pad)
    glow.addColorStop(0, 'rgba(0, 240, 255, 0.35)')
    glow.addColorStop(1, 'rgba(0, 240, 255, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, r + pad, 0, Math.PI * 2)
    ctx.fill()
    // Glass.
    const glass = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
    glass.addColorStop(0, 'rgba(40, 30, 60, 0.8)')
    glass.addColorStop(1, 'rgba(8, 6, 18, 0.88)')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    // Brass rings.
    const ring = ctx.createLinearGradient(-r, -r, r, r)
    ring.addColorStop(0, BRASS_LIGHT)
    ring.addColorStop(0.5, BRASS)
    ring.addColorStop(1, BRASS_DARK)
    ctx.strokeStyle = ring
    ctx.lineWidth = r * 0.07
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.965, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = r * 0.015
    for (const k of [0.86, 0.5]) {
      ctx.beginPath()
      ctx.arc(0, 0, r * k, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Minute lines.
    ctx.strokeStyle = BRASS_LIGHT
    ctx.lineCap = 'round'
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0
      const a = (i / 60) * Math.PI * 2
      ctx.lineWidth = r * (long ? 0.028 : 0.01)
      ctx.beginPath()
      ctx.moveTo(Math.sin(a) * r * (long ? 0.76 : 0.81), -Math.cos(a) * r * (long ? 0.76 : 0.81))
      ctx.lineTo(Math.sin(a) * r * 0.86, -Math.cos(a) * r * 0.86)
      ctx.stroke()
    }
    // Roman numerals, turned to face the centre.
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    ctx.fillStyle = BRASS_LIGHT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    numerals.forEach((text, i) => {
      ctx.save()
      ctx.rotate((i / 12) * Math.PI * 2)
      ctx.font = `bold ${Math.round(r * (text.length > 2 ? 0.13 : 0.16))}px "Times New Roman", Georgia, serif`
      ctx.fillText(text, 0, -r * 0.63)
      ctx.restore()
    })
    // A gothic rose in the middle: four pointed petals.
    ctx.strokeStyle = 'rgba(246, 214, 138, 0.45)'
    ctx.lineWidth = r * 0.012
    for (let i = 0; i < 4; i++) {
      ctx.save()
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(r * 0.12, -r * 0.2, 0, -r * 0.38)
      ctx.quadraticCurveTo(-r * 0.12, -r * 0.2, 0, 0)
      ctx.stroke()
      ctx.restore()
    }
  })
}

// A gothic hand pointing up from the sprite's centre. length: centre to tip.
function drawHand(length, width) {
  const s = 2 * length * 1.05
  return sprite(s, (ctx, size) => {
    const c = size / 2
    ctx.translate(c, c)
    const L = length
    const w = width
    const fill = ctx.createLinearGradient(-w * 3, 0, w * 3, 0)
    fill.addColorStop(0, BRASS_DARK)
    fill.addColorStop(0.5, BRASS_LIGHT)
    fill.addColorStop(1, BRASS)
    ctx.fillStyle = fill
    ctx.strokeStyle = 'rgba(20, 12, 4, 0.9)'
    ctx.lineWidth = Math.max(1, w * 0.25)
    ctx.lineJoin = 'round'

    const shape = new Path2D()
    // Tail with a round counterweight.
    shape.arc(0, L * 0.16, w * 1.6, 0, Math.PI * 2)
    // Shaft.
    shape.rect(-w / 2, -L * 0.78, w, L * 0.94)
    // Crossbar with balls at its ends.
    shape.rect(-w * 2.4, -L * 0.3 - w * 0.35, w * 4.8, w * 0.7)
    shape.moveTo(-w * 2.4 + w * 0.7, -L * 0.3)
    shape.arc(-w * 2.4, -L * 0.3, w * 0.7, 0, Math.PI * 2)
    shape.moveTo(w * 2.4 + w * 0.7, -L * 0.3)
    shape.arc(w * 2.4, -L * 0.3, w * 0.7, 0, Math.PI * 2)
    // Spade tip: a pointed leaf with curved sides.
    shape.moveTo(0, -L)
    shape.quadraticCurveTo(w * 3.2, -L * 0.84, w * 0.5, -L * 0.72)
    shape.lineTo(-w * 0.5, -L * 0.72)
    shape.quadraticCurveTo(-w * 3.2, -L * 0.84, 0, -L)
    ctx.fill(shape)
    ctx.stroke(shape)
    // Open ring on the shaft.
    ctx.lineWidth = w * 0.9
    ctx.strokeStyle = BRASS
    ctx.beginPath()
    ctx.arc(0, -L * 0.52, w * 1.6, 0, Math.PI * 2)
    ctx.stroke()
  })
}

// size: the canvas height, so the clock scales with the view.
export function createClock(x, y, size) {
  const r = size * 0.16
  const lift = r * 1.15 // the clock sits above the fingertip
  let cx = x
  let cy = y - lift
  let t = 0
  const face = drawFace(r)
  const minuteHand = drawHand(r * 0.78, r * 0.045)
  const hourHand = drawHand(r * 0.52, r * 0.06)
  // Starts at ten past ten, the classic clock-face time.
  const hourStart = (10 + 10 / 60) * (Math.PI / 6)
  const minuteStart = (10 / 60) * Math.PI * 2

  function stamp(ctx, image, angle, alpha) {
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.drawImage(image, -image.width / 2, -image.height / 2)
    ctx.restore()
  }

  return {
    // Ease towards the fingertip so tracker jitter doesn't shake the clock.
    setPosition(nx, ny) {
      cx += (nx - cx) * 0.4
      cy += (ny - lift - cy) * 0.4
    },
    get done() {
      return t > END
    },
    update(dt) {
      t += dt
    },
    draw(ctx) {
      const grow = Math.min(1, t / APPEAR)
      const scale = 0.6 + 0.4 * (1 - (1 - grow) ** 3) + 0.06 * Math.sin(Math.PI * grow)
      const fadeStart = END - FADE
      const alpha = Math.min(1, t / (APPEAR * 0.6)) * (t > fadeStart ? Math.max(0, 1 - (t - fadeStart) / FADE) : 1)
      if (alpha <= 0) return
      ctx.save()
      ctx.globalAlpha = alpha

      // Ripples: three slow rings spreading out.
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineWidth = Math.max(1, r * 0.02)
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.45 + i / 3) % 1)
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 * (1 - k)})`
        ctx.beginPath()
        ctx.arc(cx, cy, r * (1 + 0.9 * k), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
      ctx.drawImage(face, cx - face.width / 2, cy - face.height / 2)

      // The hands. The minute hand turns a quarter of the second hand's
      // speed, the hour hand a twelfth of that.
      const glide = glideAt(t)
      const minute = (a) => minuteStart + (a * STEP) / 4
      const hour = (a) => hourStart + (a * STEP) / 48
      // Motion blur while fast: earlier positions, fainter.
      const now = TICKS.findIndex((tick) => tick > t)
      const gap = now > 0 ? TICKS[now] - TICKS[now - 1] : 1
      const blur = Math.max(0, Math.min(1, (0.2 - gap) / 0.14))
      if (blur > 0) {
        for (const [back, fade] of [
          [0.6, 0.35],
          [1.2, 0.18],
        ]) {
          stamp(ctx, minuteHand, minute(glide - back), fade * blur)
        }
      }
      stamp(ctx, hourHand, hour(glide), 1)
      stamp(ctx, minuteHand, minute(glide), 1)

      // Second hand: a thin red needle with a short tail, jumping on ticks.
      const second = jumpsAt(t) * STEP
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(second)
      ctx.strokeStyle = '#ff3b6b'
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1, r * 0.014)
      ctx.beginPath()
      ctx.moveTo(0, r * 0.18)
      ctx.lineTo(0, -r * 0.84)
      ctx.stroke()
      ctx.restore()

      // Centre cap.
      ctx.fillStyle = BRASS_LIGHT
      ctx.strokeStyle = BRASS_DARK
      ctx.lineWidth = Math.max(1, r * 0.012)
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.055, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      ctx.restore()
    },
  }
}
