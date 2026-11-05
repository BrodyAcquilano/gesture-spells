// "Fireball": a ball of fire that forms at the open palm and rushes towards
// the camera, growing as it comes, then bursts and burns out (about 2 s).
//
//   0 – 0.9 s   the ball grows from palm-sized to a third of the view, speeding
//               up (it is coming towards you), and drifts towards the centre
//   0.9 – 1.3 s it bursts: grows fast and fades
//   then        the last flames and embers burn out
//
// The ball is a radial gradient from white-hot through yellow and orange to
// deep red. Flames are particles thrown off its surface that cool as they
// age: yellow → orange → red → smoke. Embers are small bright sparks that
// fly further. Flames and embers use additive blending so they glow.

const GROW = 0.9
const BURST = 0.4

// Soft round "sprites" drawn once and reused, one per flame colour; stamping
// an image is far cheaper than building a gradient for every particle.
let sprites = null
function makeSprites() {
  const colour = (r, g, b) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
    gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.5)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    return canvas
  }
  return {
    hot: colour(255, 240, 170),
    yellow: colour(255, 200, 60),
    orange: colour(255, 120, 20),
    red: colour(210, 40, 10),
    smoke: colour(60, 30, 25),
  }
}

function easeIn(k) {
  return k * k
}

// x, y: the palm. size: the canvas height.
export function createFireball(x, y, size, canvasWidth) {
  sprites ??= makeSprites()
  let t = 0
  let flames = []
  let embers = []
  const target = { x: x + (canvasWidth / 2 - x) * 0.35, y: y + (size / 2 - y) * 0.35 }
  let ball = { x, y, r: size * 0.04, alpha: 1 }

  function emit(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = ball.r * (0.6 + Math.random() * 1.6)
      const life = 0.3 + Math.random() * 0.45
      flames.push({
        x: ball.x + Math.cos(angle) * ball.r * 0.6,
        y: ball.y + Math.sin(angle) * ball.r * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - ball.r * 1.2, // flames rise
        size: ball.r * (0.5 + Math.random() * 0.7),
        life,
        maxLife: life,
      })
    }
  }

  function emitEmbers(count, speedScale) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = size * (0.1 + Math.random() * 0.4) * speedScale
      const life = 0.6 + Math.random() * 0.9
      embers.push({ x: ball.x, y: ball.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life })
    }
  }

  return {
    get done() {
      return t > GROW + BURST && flames.length === 0 && embers.length === 0
    },
    update(dt) {
      t += dt
      if (t < GROW) {
        const k = easeIn(t / GROW)
        ball = { x: x + (target.x - x) * k, y: y + (target.y - y) * k, r: size * (0.04 + 0.3 * k), alpha: Math.min(1, t / 0.08) }
        emit(Math.round(45 * dt * (1 + 3 * k)))
        if (Math.random() < dt * 25) emitEmbers(1, 0.6)
      } else if (t < GROW + BURST) {
        const k = (t - GROW) / BURST
        if (!ball.burst) emitEmbers(40, 1.4) // once, as it bursts
        ball = { ...ball, r: size * (0.34 + 0.25 * k), alpha: 1 - k, burst: true }
        emit(Math.round(110 * dt * (1 - k)))
      } else {
        ball = { ...ball, alpha: 0 }
      }
      for (const f of flames) {
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.vx *= 0.96
        f.vy *= 0.96
        f.life -= dt
      }
      flames = flames.filter((f) => f.life > 0)
      for (const e of embers) {
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.vy += size * 0.15 * dt // a little gravity
        e.life -= dt
      }
      embers = embers.filter((e) => e.life > 0)
    },
    draw(ctx) {
      ctx.save()
      // Smoke first, with normal blending, so it darkens rather than glows.
      for (const f of flames) {
        const age = 1 - f.life / f.maxLife
        if (age < 0.7) continue
        ctx.globalAlpha = 0.25 * (1 - age) * 3
        const s = f.size * (1 + age)
        ctx.drawImage(sprites.smoke, f.x - s, f.y - s, s * 2, s * 2)
      }
      ctx.globalCompositeOperation = 'lighter'
      for (const f of flames) {
        const age = 1 - f.life / f.maxLife // 0 new … 1 gone
        const sprite = age < 0.12 ? sprites.yellow : age < 0.45 ? sprites.orange : sprites.red
        ctx.globalAlpha = Math.min(1, (1 - age) * 1.4) * 0.28
        const s = f.size * (1 - 0.4 * age)
        ctx.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2)
      }
      if (ball.alpha > 0) {
        const flicker = 1 + 0.06 * Math.sin(t * 37) + 0.04 * Math.sin(t * 61)
        const r = ball.r * flicker
        const core = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, r)
        core.addColorStop(0, `rgba(255, 255, 235, ${ball.alpha})`)
        core.addColorStop(0.15, `rgba(255, 225, 120, ${ball.alpha})`)
        core.addColorStop(0.45, `rgba(255, 120, 25, ${0.85 * ball.alpha})`)
        core.addColorStop(0.78, `rgba(220, 45, 10, ${0.5 * ball.alpha})`)
        core.addColorStop(1, 'rgba(120, 10, 0, 0)')
        ctx.globalAlpha = 1
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const e of embers) {
        ctx.globalAlpha = Math.min(1, (e.life / e.maxLife) * 1.5)
        const s = size * 0.006
        ctx.drawImage(sprites.hot, e.x - s * 2, e.y - s * 2, s * 4, s * 4)
      }
      ctx.restore()
    },
  }
}
