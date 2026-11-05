// "Sprout": the index finger turns into a branch, which grows on past the
// fingertip and opens into a sprout with two leaves (about 5 s in all). It is
// drawn along the finger's joints every frame, so it bends and moves with the
// finger (setFinger).
//
// Stages:
//   0   – 0.9 s  bark creeps up the finger from the knuckle to the tip
//   0.9 – 1.7 s  the branch grows on past the fingertip, about half a finger
//                length, curving slightly
//   1.7 – 3.3 s  a green shoot comes out of the branch's end and two leaves
//                slowly unfold from it, with a bud between them and a few
//                specks of green light
//   then it holds, sways gently, and fades out by about 5.2 s
//
// The bark is an outline along the finger with wood grain drawn inside it
// each frame (wavy streaks along the wood, deeper furrows, knots the grain
// bends around, an uneven edge and rounded shading), all plain lines, no
// shadows; the leaf is drawn once into a small image and stamped twice.

const FINGER_UNTIL = 0.9
const BRANCH_UNTIL = 1.7
const SHOOT_UNTIL = 2.1
const LEAVES_UNTIL = 3.3
const HOLD_UNTIL = 4.6
const FADE = 0.6
const END = HOLD_UNTIL + FADE
const EXTEND = 0.5 // the branch past the fingertip, as a share of the finger's length

const BARK = '#6b4423'
const BARK_DARK = '#2e1a0c'

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ease = (x) => 1 - (1 - clamp01(x)) ** 3
const easeBack = (x) => {
  const k = clamp01(x) - 1
  return 1 + 2.2 * k ** 3 + 1.2 * k ** 2
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const scale = (a, k) => [a[0] * k, a[1] * k]
const length = (a) => Math.hypot(a[0], a[1])
const unit = (a) => {
  const l = length(a) || 1
  return [a[0] / l, a[1] / l]
}

// A leaf pointing up from the bottom centre of its image.
function leafSprite(height) {
  const width = height * 0.5
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width + 4)
  canvas.height = Math.ceil(height + 4)
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height - 2)
  const shape = new Path2D()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(width * 0.55, -height * 0.2, width * 0.5, -height * 0.7, 0, -height)
  shape.bezierCurveTo(-width * 0.5, -height * 0.7, -width * 0.55, -height * 0.2, 0, 0)
  const fill = ctx.createLinearGradient(-width / 2, 0, width / 2, -height)
  fill.addColorStop(0, '#2f8f3a')
  fill.addColorStop(0.6, '#5cc85a')
  fill.addColorStop(1, '#a6ef7c')
  ctx.fillStyle = fill
  ctx.fill(shape)
  ctx.strokeStyle = '#1d5a24'
  ctx.lineWidth = Math.max(1, height * 0.02)
  ctx.stroke(shape)
  // Midrib and veins.
  ctx.strokeStyle = 'rgba(220, 255, 200, 0.6)'
  ctx.lineWidth = Math.max(1, height * 0.018)
  ctx.beginPath()
  ctx.moveTo(0, -height * 0.05)
  ctx.lineTo(0, -height * 0.9)
  for (const k of [0.3, 0.5, 0.7]) {
    ctx.moveTo(0, -height * k)
    ctx.lineTo(width * 0.28, -height * (k + 0.12))
    ctx.moveTo(0, -height * k)
    ctx.lineTo(-width * 0.28, -height * (k + 0.12))
  }
  ctx.stroke()
  return canvas
}

// Smooth, repeatable wobble between about -1 and 1 (a few sine waves added
// up), so the grain and the rough edge stay fixed to the wood as it grows.
function wobble(x) {
  return (Math.sin(x) + 0.6 * Math.sin(2.13 * x + 1.7) + 0.3 * Math.sin(4.37 * x + 0.3)) / 1.9
}

// Knots: where along the wood (in finger lengths from the knuckle) and how
// far across (-0.5 one edge, 0.5 the other).
const KNOTS = [
  [0.33, 0.18],
  [0.66, -0.22],
  [1.18, 0.12],
]
// Grain streaks running along the wood: how far across, and light or dark.
const GRAIN = [-0.4, -0.31, -0.22, -0.12, -0.03, 0.06, 0.16, 0.25, 0.34, 0.42].map((across, j) => ({ across, dark: j % 3 !== 1, seed: j * 7.3 }))
// Deeper cracks in the bark.
const FURROWS = [-0.27, 0.02, 0.29]

// Bark with wood grain along a path of points (knuckle first) with a width
// at each. Everything is measured in finger lengths along the wood, so the
// pattern doesn't slide as the branch grows or the finger moves.
function drawBark(ctx, shown, widths, fingerLength, alpha) {
  // Resample into small steps.
  const step = Math.max(1.5, fingerLength * 0.02)
  const samples = []
  let along = 0
  for (let i = 1; i < shown.length; i++) {
    const d = sub(shown[i], shown[i - 1])
    const seg = length(d)
    const count = Math.max(1, Math.ceil(seg / step))
    const dirHere = unit(d)
    const normal = [-dirHere[1], dirHere[0]]
    for (let k = i === 1 ? 0 : 1; k <= count; k++) {
      const f = k / count
      samples.push({
        p: add(shown[i - 1], scale(d, f)),
        w: widths[i - 1] + (widths[i] - widths[i - 1]) * f,
        n: normal,
        s: (along + seg * f) / fingerLength,
      })
    }
    along += seg
  }
  if (samples.length < 2) return
  // Smooth the normals at the joints.
  for (let i = 1; i < samples.length - 1; i++) samples[i].n = unit(add(samples[i - 1].n, samples[i + 1].n))

  // Where a point across the wood is: across from -0.5 to 0.5 of the width.
  const at = (sample, across) => add(sample.p, scale(sample.n, sample.w * across))

  // The outline, a little uneven on each side, rounded at the growing end.
  const edge = (sample, sign) => 0.5 * sign * (1 + 0.07 * wobble(sample.s * 31 + (sign > 0 ? 0 : 50)) + 0.04 * wobble(sample.s * 73 + sign))
  const outline = new Path2D()
  samples.forEach((sample, i) => {
    const q = at(sample, edge(sample, 1))
    if (i === 0) outline.moveTo(...q)
    else outline.lineTo(...q)
  })
  const last = samples[samples.length - 1]
  const endAngle = Math.atan2(last.n[1], last.n[0])
  outline.arc(last.p[0], last.p[1], last.w / 2, endAngle, endAngle + Math.PI, true)
  for (let i = samples.length - 1; i >= 0; i--) outline.lineTo(...at(samples[i], edge(samples[i], -1)))
  outline.closePath()

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = BARK
  ctx.fill(outline)
  ctx.clip(outline)

  const line = (across, from, to) => {
    ctx.beginPath()
    for (let i = from; i <= to; i++) {
      const q = at(samples[i], across(samples[i]))
      if (i === from) ctx.moveTo(...q)
      else ctx.lineTo(...q)
    }
    ctx.stroke()
  }
  // Runs of samples where a streak shows (it breaks off in places).
  const runs = (shows) => {
    const out = []
    let start = -1
    samples.forEach((sample, i) => {
      if (shows(sample) && start === -1) start = i
      if ((!shows(sample) || i === samples.length - 1) && start !== -1) {
        if (i - start >= 2) out.push([start, i])
        start = -1
      }
    })
    return out
  }

  // Rounded look: shade along one side, light along the other.
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(30, 16, 6, 0.45)'
  ctx.lineWidth = fingerLength * 0.07
  line(() => -0.38, 0, samples.length - 1)
  ctx.strokeStyle = 'rgba(190, 140, 80, 0.3)'
  ctx.lineWidth = fingerLength * 0.04
  line(() => 0.2, 0, samples.length - 1)

  // How far a knot pushes the grain aside near it.
  const knotPush = (sample, across) => {
    let push = 0
    for (const [ks, ka] of KNOTS) {
      const near = Math.exp(-(((sample.s - ks) / 0.07) ** 2)) * Math.max(0, 1 - Math.abs(across - ka) / 0.3)
      push += Math.sign(across - ka || 1) * 0.13 * near
    }
    return push
  }

  // Grain: wavy streaks along the wood, light and dark, breaking off now and then.
  for (const grain of GRAIN) {
    const across = (sample) => {
      const a = grain.across + 0.035 * wobble(sample.s * 9 + grain.seed)
      return a + knotPush(sample, a)
    }
    ctx.strokeStyle = grain.dark ? 'rgba(48, 26, 10, 0.6)' : 'rgba(170, 120, 66, 0.45)'
    ctx.lineWidth = Math.max(1, fingerLength * (grain.dark ? 0.012 : 0.009))
    for (const [from, to] of runs((sample) => wobble(sample.s * 5.3 + grain.seed * 1.9) > -0.35)) line(across, from, to)
  }

  // Furrows: deeper, darker cracks in the bark, in broken lengths.
  ctx.strokeStyle = 'rgba(26, 14, 5, 0.75)'
  ctx.lineWidth = Math.max(1, fingerLength * 0.022)
  FURROWS.forEach((base, j) => {
    const across = (sample) => {
      const a = base + 0.05 * wobble(sample.s * 6 + j * 11)
      return a + knotPush(sample, a)
    }
    for (const [from, to] of runs((sample) => wobble(sample.s * 3.1 + j * 4.7) > 0.05)) line(across, from, to)
  })

  // Knots: dark ovals along the wood with a lighter ring, once grown to.
  for (const [ks, ka] of KNOTS) {
    const sample = samples.find((x) => x.s >= ks)
    if (!sample || last.s - ks < 0.04) continue
    const centre = at(sample, ka)
    const angle = Math.atan2(sample.n[1], sample.n[0]) // the oval lies along the wood
    ctx.save()
    ctx.translate(...centre)
    ctx.rotate(angle)
    ctx.fillStyle = '#2a170a'
    ctx.strokeStyle = 'rgba(176, 124, 68, 0.7)'
    ctx.lineWidth = Math.max(1, fingerLength * 0.01)
    ctx.beginPath()
    ctx.ellipse(0, 0, sample.w * 0.1, sample.w * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, 0, sample.w * 0.15, sample.w * 0.25, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = BARK_DARK
  ctx.lineWidth = Math.max(1, fingerLength * 0.014)
  ctx.stroke(outline)
  ctx.restore()
}

// x, y: the index fingertip; size: the canvas height. Without a hand (the
// library preview) the finger is imagined pointing straight up to x, y.
export function createSprout(x, y, size) {
  let t = 0
  const defaultLength = size * 0.16
  let finger = [0.95, 0.62, 0.3, 0].map((k) => [x, y + defaultLength * k])
  let leaf = null
  let leafFor = 0
  const motes = Array.from({ length: 10 }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.5,
    life: 0.8 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
  }))

  return {
    // Follow the finger, easing so tracker jitter doesn't shake the branch.
    setFinger(points, immediately = false) {
      finger = finger.map((old, i) => (immediately ? [...points[i]] : add(old, scale(sub(points[i], old), 0.5))))
    },
    setPosition() {
      // The finger's joints (setFinger) say where everything goes.
    },
    get done() {
      return t > END
    },
    update(dt) {
      t += dt
    },
    draw(ctx) {
      const alpha = t > HOLD_UNTIL ? clamp01(1 - (t - HOLD_UNTIL) / FADE) : 1
      if (alpha <= 0) return
      const fingerLength = length(sub(finger[1], finger[0])) + length(sub(finger[2], finger[1])) + length(sub(finger[3], finger[2]))
      if (fingerLength < 2) return
      const tip = finger[3]
      const dir = unit(add(sub(finger[3], finger[2]), sub(finger[3], finger[1])))
      const side = [-dir[1], dir[0]]
      // The branch past the fingertip: a gentle curve.
      const extend = fingerLength * EXTEND
      const sway = Math.sin(t * 1.8) * 0.04
      const branch = [0.25, 0.5, 0.75, 1].map((k) => add(tip, add(scale(dir, extend * k), scale(side, extend * (0.12 * k * k + sway * k)))))
      const path = [...finger, ...branch]
      const widthAt = (i) => fingerLength * [0.27, 0.25, 0.23, 0.2, 0.16, 0.13, 0.1, 0.08][i]

      // How much of the path has grown, in pixels from the knuckle.
      const segment = path.slice(1).map((p, i) => length(sub(p, path[i])))
      const fingerPart = segment.slice(0, 3).reduce((a, b) => a + b, 0)
      const branchPart = segment.slice(3).reduce((a, b) => a + b, 0)
      const grown = fingerPart * ease(t / FINGER_UNTIL) + branchPart * ease((t - FINGER_UNTIL) / (BRANCH_UNTIL - FINGER_UNTIL))

      // The grown part of the path, cut off at `grown`.
      const shown = [path[0]]
      const widths = [widthAt(0)]
      let left = grown
      for (let i = 0; i < segment.length && left > 0; i++) {
        const k = Math.min(1, left / (segment[i] || 1))
        shown.push(add(path[i], scale(sub(path[i + 1], path[i]), k)))
        widths.push(widthAt(i) + (widthAt(i + 1) - widthAt(i)) * k)
        left -= segment[i]
      }

      ctx.save()
      ctx.globalAlpha = alpha
      if (shown.length > 1) drawBark(ctx, shown, widths, fingerLength, alpha)

      // The shoot, leaves and bud at the branch's end.
      if (t > BRANCH_UNTIL) {
        const base = branch[branch.length - 1]
        const branchDir = unit(sub(branch[3], branch[2]))
        const shootLength = fingerLength * 0.14 * ease((t - BRANCH_UNTIL) / (SHOOT_UNTIL - BRANCH_UNTIL))
        const shootTip = add(base, scale(branchDir, shootLength))
        ctx.strokeStyle = '#4aa64a'
        ctx.lineCap = 'round'
        ctx.lineWidth = Math.max(1, fingerLength * 0.045)
        ctx.beginPath()
        ctx.moveTo(...base)
        ctx.lineTo(...shootTip)
        ctx.stroke()

        const leafHeight = fingerLength * 0.42
        if (!leaf || Math.abs(leafFor - leafHeight) > leafHeight * 0.25) {
          leaf = leafSprite(leafHeight)
          leafFor = leafHeight
        }
        const pointing = Math.atan2(branchDir[0], -branchDir[1])
        const open = (delay) => clamp01((t - SHOOT_UNTIL + 0.1 - delay) / (LEAVES_UNTIL - SHOOT_UNTIL - 0.2))
        for (const [turn, delay] of [
          [-1, 0],
          [1, 0.25],
        ]) {
          const k = open(delay)
          if (k <= 0) continue
          const grow = 0.15 + 0.85 * easeBack(k)
          const angle = pointing + turn * (0.12 + 0.85 * ease(k) + 0.04 * Math.sin(t * 2.2 + turn))
          ctx.save()
          ctx.translate(...shootTip)
          ctx.rotate(angle)
          ctx.scale(grow * (leafHeight / leafFor), grow * (leafHeight / leafFor))
          ctx.drawImage(leaf, -leaf.width / 2, -leaf.height + 2)
          ctx.restore()
        }
        // The bud between the leaves.
        const bud = ease((t - SHOOT_UNTIL) / 1.2)
        if (bud > 0) {
          ctx.save()
          ctx.translate(...shootTip)
          ctx.rotate(pointing)
          ctx.fillStyle = '#b8f28c'
          ctx.strokeStyle = '#2f7a35'
          ctx.lineWidth = Math.max(1, fingerLength * 0.01)
          ctx.beginPath()
          ctx.ellipse(0, -fingerLength * 0.06 * bud, fingerLength * 0.035 * bud, fingerLength * 0.07 * bud, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
        // Specks of green light drifting up from the sprout as it opens.
        const since = t - SHOOT_UNTIL
        if (since > 0) {
          ctx.globalCompositeOperation = 'lighter'
          for (const m of motes) {
            if (since > m.life + 0.6) continue
            const d = fingerLength * m.speed * since
            const p = add(shootTip, [Math.cos(m.angle) * d * 0.6, Math.sin(m.angle) * d * 0.4 - d * 0.5])
            const fade = clamp01(1 - since / (m.life + 0.6)) * (0.6 + 0.4 * Math.sin(t * 9 + m.phase))
            ctx.fillStyle = `rgba(170, 255, 140, ${0.8 * fade})`
            ctx.beginPath()
            ctx.arc(p[0], p[1], Math.max(1, fingerLength * 0.018), 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      ctx.restore()
    },
  }
}
