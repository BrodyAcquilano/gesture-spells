// Plays a spell's effects on a canvas: its animation at a point, and its
// sound. Used by live casting and by the spellbook's gesture playback.
//
//   cast({ animation, audio, x, y, label })   x, y in canvas pixels
//   update(dt) and draw(ctx) every frame, clear() when stopping
//   pause() / resume()  freeze and continue everything, sound and video included
//   busy()  true while anything is still playing: particles, a video or image,
//           a label or a sound. Nothing is cut short, so a caller can wait
//           for busy() to turn false to know the longest part has finished.
//
// Animations: the built-in ✨ sparks are drawn by code. Video files (WebM,
// MP4) play centred on the point, to their end. Images (GIF, WebP, PNG) show for 1.5 s and
// fade. Lottie files are not drawn yet. Audio files play through an <audio>
// element. The spell's name floats up briefly so a cast is always visible.
import { createSparks } from './sparks.js'
import { previewKind } from '../library/formats.js'

const IMAGE_SECONDS = 1.5
const LABEL_SECONDS = 1.2

export function createEffectPlayer() {
  const sparks = createSparks()
  let overlays = [] // { element, kind, x, y, age, life }
  let labels = [] // { text, x, y, age }
  const sounds = new Set()
  let paused = false

  function playSound(audio) {
    if (!audio?.url) return
    const element = new Audio(audio.url)
    sounds.add(element)
    element.addEventListener('ended', () => sounds.delete(element))
    element.addEventListener('error', () => sounds.delete(element))
    element.play().catch(() => sounds.delete(element))
  }

  function startAnimation(animation, x, y) {
    if (!animation) return
    if (animation.procedural === 'sparks') {
      sparks.burst(x, y)
      return
    }
    if (!animation.url) return
    const kind = previewKind('animations', animation)
    if (kind === 'video') {
      const element = document.createElement('video')
      element.src = animation.url
      element.muted = true
      element.playsInline = true
      const overlay = { element, kind, x, y, age: 0, life: Infinity, failed: false }
      element.addEventListener('error', () => (overlay.failed = true))
      element.play().catch(() => (overlay.failed = true))
      overlays.push(overlay)
    } else if (kind === 'image') {
      const element = new Image()
      element.src = animation.url
      overlays.push({ element, kind, x, y, age: 0, life: IMAGE_SECONDS })
    }
  }

  return {
    cast({ animation, audio, x, y, label, sound = true }) {
      startAnimation(animation, x, y)
      if (sound) playSound(audio)
      if (label) labels.push({ text: label, x, y, age: 0 })
    },
    update(dt) {
      if (paused) return
      sparks.update(dt)
      for (const overlay of overlays) overlay.age += dt
      overlays = overlays.filter((overlay) => {
        const done = overlay.age > overlay.life || overlay.failed || (overlay.kind === 'video' && overlay.element.ended)
        if (done && overlay.kind === 'video') overlay.element.pause()
        return !done
      })
      for (const label of labels) label.age += dt
      labels = labels.filter((label) => label.age < LABEL_SECONDS)
    },
    draw(ctx) {
      const size = ctx.canvas.height * 0.45
      for (const overlay of overlays) {
        const { element } = overlay
        const width = element.videoWidth || element.naturalWidth
        const height = element.videoHeight || element.naturalHeight
        if (!width || !height) continue
        const fit = Math.min(size / width, size / height)
        ctx.save()
        if (overlay.kind === 'image') ctx.globalAlpha = Math.min(1, (overlay.life - overlay.age) * 2)
        ctx.drawImage(element, overlay.x - (width * fit) / 2, overlay.y - (height * fit) / 2, width * fit, height * fit)
        ctx.restore()
      }
      sparks.draw(ctx)
      ctx.save()
      ctx.font = `600 ${Math.round(ctx.canvas.height * 0.04)}px "Cascadia Code", Consolas, monospace`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ff2bd6'
      ctx.shadowColor = '#ff2bd6'
      ctx.shadowBlur = 12
      for (const label of labels) {
        ctx.globalAlpha = 1 - label.age / LABEL_SECONDS
        ctx.fillText(label.text, label.x, label.y - 40 - label.age * 60)
      }
      ctx.restore()
    },
    pause() {
      paused = true
      for (const element of sounds) element.pause()
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.pause()
    },
    resume() {
      paused = false
      for (const element of sounds) element.play().catch(() => sounds.delete(element))
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.play().catch(() => {})
    },
    busy() {
      return sparks.count > 0 || overlays.length > 0 || labels.length > 0 || sounds.size > 0
    },
    clear() {
      paused = false
      sparks.clear()
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.pause()
      overlays = []
      labels = []
      for (const element of sounds) element.pause()
      sounds.clear()
    },
  }
}
