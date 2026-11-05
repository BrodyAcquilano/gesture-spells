// A small particle system that throws 🪙 gold coins. Each particle has a position,
// velocity and lifetime. Every frame they move by velocity × time, fall
// under a little gravity, and fade out as their life runs down.
//
// The glowing 🪙 is drawn once into a small image ("sprite") and then stamped
// for each particle. Drawing emoji text with a blur shadow for every particle
// every frame is slow enough to make the animation stutter.

const GRAVITY = 320 // pixels per second², downwards
const BURST_COUNT = 5
const SPRITE_SIZE = 64

let sprite = null
function makeSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${SPRITE_SIZE * 0.6}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
  ctx.shadowColor = 'rgba(255, 200, 40, 0.9)'
  ctx.shadowBlur = SPRITE_SIZE * 0.15
  ctx.fillText('🪙', SPRITE_SIZE / 2, SPRITE_SIZE / 2)
  return canvas
}

function random(min, max) {
  return min + Math.random() * (max - min)
}

export function createCoins() {
  sprite ??= makeSprite()
  let particles = []

  return {
    // A quick burst when a spell is cast: fast, short-lived coins.
    // scale: 1 for a 720-pixel-tall view; sizes and speeds follow the view.
    burst(x, y, count = BURST_COUNT, scale = 1) {
      for (let i = 0; i < count; i++) {
        const angle = random(0, Math.PI * 2)
        const speed = random(1200, 2000) * scale
        const life = random(0.25, 0.4)
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - speed * 0.3, // a slight upward bias
          size: random(40, 64) * scale,
          gravity: GRAVITY * scale,
          spin: random(8, 16), // flips per second, drawn by squashing the coin sideways
          phase: random(0, Math.PI * 2),
          life,
          maxLife: life,
        })
      }
    },
    update(dt) {
      for (const p of particles) {
        p.vx *= Math.max(0, 1 - 3.5 * dt) // air drag
        p.vy = p.vy * Math.max(0, 1 - 3.5 * dt) + p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.phase += p.spin * dt
        p.life -= dt
      }
      particles = particles.filter((p) => p.life > 0)
    },
    draw(ctx) {
      ctx.save()
      for (const p of particles) {
        const t = p.life / p.maxLife // 1 when born, 0 when gone
        // Full size and brightness for the first half of its life, then a
        // quick fade while it is still moving, so nothing lingers.
        const fade = Math.min(1, t * 2)
        const size = p.size * (0.7 + 0.3 * fade)
        ctx.globalAlpha = fade
        const width = size * Math.max(0.15, Math.abs(Math.cos(p.phase))) // the coin turning over
        ctx.drawImage(sprite, p.x - width / 2, p.y - size / 2, width, size)
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
