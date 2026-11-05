// "Illumination": a point of light that flares at the fingertip after a snap,
// glows for a moment, then fades (about 2 s in all).
//
// Layers, all drawn with additive blending ('lighter') so overlapping light
// adds up towards white, like real light:
//   flash ring  a thin ring that expands quickly at the moment of the snap
//   halo        a large soft warm glow
//   core        a small white-hot centre
//   flare       two thin streaks crossing the core, slowly turning
//   motes       a few specks of light drifting outwards and twinkling

const FLARE_IN = 0.06 // seconds to full brightness
const HOLD = 0.5 // seconds before it starts to fade
const FADE = 0.45 // fade time constant
const END = 2.1

function brightness(t) {
  if (t < FLARE_IN) return t / FLARE_IN
  if (t < HOLD) return 1 - 0.15 * ((t - FLARE_IN) / (HOLD - FLARE_IN))
  return 0.85 * Math.exp(-(t - HOLD) / FADE)
}

// size: the canvas height, so the light scales with the view.
export function createIllumination(x, y, size) {
  let t = 0
  const motes = Array.from({ length: 16 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = size * (0.02 + Math.random() * 0.08)
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - size * 0.01,
      life: 0.8 + Math.random() * 1.0,
      phase: Math.random() * Math.PI * 2,
      r: size * (0.003 + Math.random() * 0.004),
    }
  })

  return {
    get done() {
      return t > END
    },
    update(dt) {
      t += dt
      for (const m of motes) {
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.vx *= 0.98
        m.vy *= 0.98
        m.life -= dt
      }
    },
    draw(ctx) {
      const b = brightness(t) * (1 + 0.05 * Math.sin(t * 40))
      if (b <= 0.002 && t > HOLD) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Flash ring, only in the first 0.35 s.
      if (t < 0.35) {
        const k = t / 0.35
        ctx.strokeStyle = `rgba(255, 245, 210, ${0.6 * (1 - k)})`
        ctx.lineWidth = Math.max(1, size * 0.006 * (1 - k))
        ctx.beginPath()
        ctx.arc(x, y, size * 0.22 * Math.sqrt(k), 0, Math.PI * 2)
        ctx.stroke()
      }

      const haloRadius = size * 0.17 * (0.7 + 0.3 * b)
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius)
      halo.addColorStop(0, `rgba(255, 244, 214, ${0.55 * b})`)
      halo.addColorStop(0.35, `rgba(255, 214, 140, ${0.22 * b})`)
      halo.addColorStop(1, 'rgba(255, 180, 90, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
      ctx.fill()

      // Flare streaks.
      ctx.translate(x, y)
      ctx.rotate(t * 0.4)
      for (const [length, thickness] of [
        [size * 0.32, size * 0.004],
        [size * 0.16, size * 0.003],
      ]) {
        const streak = ctx.createLinearGradient(-length, 0, length, 0)
        streak.addColorStop(0, 'rgba(255, 240, 210, 0)')
        streak.addColorStop(0.5, `rgba(255, 250, 235, ${0.7 * b})`)
        streak.addColorStop(1, 'rgba(255, 240, 210, 0)')
        ctx.fillStyle = streak
        ctx.fillRect(-length * b, -thickness / 2, 2 * length * b, thickness)
        ctx.rotate(Math.PI / 2)
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      const coreRadius = size * 0.028 * (0.6 + 0.4 * b)
      const core = ctx.createRadialGradient(x, y, 0, x, y, coreRadius)
      core.addColorStop(0, `rgba(255, 255, 255, ${b})`)
      core.addColorStop(0.5, `rgba(255, 250, 225, ${0.8 * b})`)
      core.addColorStop(1, 'rgba(255, 235, 180, 0)')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(x, y, coreRadius, 0, Math.PI * 2)
      ctx.fill()

      for (const m of motes) {
        if (m.life <= 0) continue
        const twinkle = 0.5 + 0.5 * Math.sin(t * 12 + m.phase)
        ctx.fillStyle = `rgba(255, 245, 220, ${Math.min(1, m.life) * twinkle * 0.9})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    },
  }
}
