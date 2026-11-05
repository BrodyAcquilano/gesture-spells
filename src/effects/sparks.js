// A small particle system that throws ✨ emoji. Each particle has a position,
// velocity, spin and lifetime. Every frame they move by velocity × time, fall
// under a little gravity, and fade out as their life runs down.

const GRAVITY = 260 // pixels per second², downwards
const GLYPH = '✨'

function random(min, max) {
  return min + Math.random() * (max - min)
}

export function createSparks() {
  let particles = []

  function emit(x, y, { speed, size, life }) {
    const angle = random(0, Math.PI * 2)
    const v = random(speed[0], speed[1])
    const lifetime = random(life[0], life[1])
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - v * 0.4, // a slight upward bias
      angle: random(-0.6, 0.6),
      spin: random(-4, 4),
      size: random(size[0], size[1]),
      life: lifetime,
      maxLife: lifetime,
    })
  }

  return {
    // A burst when a cast starts.
    burst(x, y, count = 28) {
      for (let i = 0; i < count; i++) {
        emit(x, y, { speed: [120, 420], size: [18, 44], life: [0.6, 1.3] })
      }
    },
    // A few slow sparks each frame while the pinch is held, leaving a trail.
    trail(x, y, count = 2) {
      for (let i = 0; i < count; i++) {
        emit(x, y, { speed: [10, 70], size: [12, 24], life: [0.4, 0.8] })
      }
    },
    update(dt) {
      for (const p of particles) {
        p.vy += GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        p.life -= dt
      }
      particles = particles.filter((p) => p.life > 0)
    },
    draw(ctx) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(255, 230, 120, 0.9)'
      ctx.shadowBlur = 12
      for (const p of particles) {
        const t = p.life / p.maxLife // 1 when born, 0 when gone
        ctx.globalAlpha = Math.min(1, t * 1.5)
        ctx.font = `${p.size * (0.6 + 0.4 * t)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
        ctx.setTransform(1, 0, 0, 1, p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillText(GLYPH, 0, 0)
      }
      ctx.restore()
    },
    get count() {
      return particles.length
    },
    clear() {
      particles = []
    },
  }
}
