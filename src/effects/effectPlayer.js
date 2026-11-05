// Plays a spell's effects on a canvas: its animation and its sound. Used by
// live casting and by the spellbook's playback.
//
//   cast({ animation, audio, points, map, x, y, label, sound })
//       points + map: the hand's landmarks and a function mapping a landmark
//       to canvas pixels; the animation then appears at its anchor on the
//       hand (pinch point, index fingertip or palm). Without them it appears
//       at x, y.
//   follow(points, map)  each frame while a hand is visible: animations that
//       follow the hand (Brightness, Clock) move with their anchor point, and
//       ones drawn along the index finger (Sprout, which has setFinger) get
//       its four joints
//   update(dt) and draw(ctx) every frame
//   pause() / resume()  freeze and continue everything, sound and video included
//   busy()  true while anything is still playing. Nothing is cut short, so a
//           caller can wait for busy() to turn false to know the longest part
//           has finished.
//   clear() stops everything
//
// Animations drawn by code (coins, illumination, fireball) come from
// animations.js. Video files (WebM, MP4) play centred on the point, to their
// end. Images (GIF, WebP, PNG) show for 1.5 s and fade. Lottie files are not
// drawn yet. Audio plays through the Web Audio API (audioEngine.js), so it
// starts the instant the spell is cast.
import { PROCEDURAL_ANIMATIONS, anchorOf } from './animations.js'
import { anchorPoint } from '../tracking/landmarks.js'
import { previewKind } from '../library/formats.js'
import { pauseAllSounds, playSound as startSound, resumeAllSounds } from './audioEngine.js'

const IMAGE_SECONDS = 1.5
const LABEL_SECONDS = 1.2

export function createEffectPlayer() {
  let instances = [] // procedural animations playing
  let overlays = [] // { element, kind, x, y, age, life, failed }
  let labels = [] // { text, x, y, age }
  let pending = [] // animations cast since the last draw (they need the canvas size)
  const sounds = new Set()
  let paused = false

  function playSound(audio) {
    if (!audio?.url) return
    const handle = startSound(audio.url)
    sounds.add(handle)
    handle.onEnd(() => sounds.delete(handle))
  }

  // The index finger's four joints (knuckle to tip) in canvas pixels.
  const indexFinger = (points, map) => [5, 6, 7, 8].map((i) => map(points[i]))

  function startAnimation(animation, x, y, ctx, finger) {
    if (!animation) return
    const procedural = PROCEDURAL_ANIMATIONS[animation.procedural]
    if (procedural) {
      const instance = procedural.create(x, y, ctx.canvas.height, ctx.canvas.width)
      if (procedural.follow) instance.anchor = procedural.anchor
      if (finger && instance.setFinger) instance.setFinger(finger, true)
      instances.push(instance)
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
    cast({ animation, audio, points, map, x, y, label, sound = true }) {
      if (points && map) [x, y] = map(anchorPoint(points, anchorOf(animation)))
      pending.push({ animation, x, y, finger: points && map ? indexFinger(points, map) : null })
      if (sound) playSound(audio)
      if (label) labels.push({ text: label, x, y, age: 0 })
    },
    follow(points, map) {
      for (const instance of instances) {
        if (instance.anchor) instance.setPosition(...map(anchorPoint(points, instance.anchor)))
        if (instance.setFinger) instance.setFinger(indexFinger(points, map))
      }
    },
    update(dt) {
      if (paused) return
      for (const instance of instances) instance.update(dt)
      instances = instances.filter((instance) => !instance.done)
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
      for (const { animation, x, y, finger } of pending) startAnimation(animation, x, y, ctx, finger)
      pending = []
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
      for (const instance of instances) instance.draw(ctx)
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
      pauseAllSounds()
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.pause()
    },
    resume() {
      paused = false
      resumeAllSounds()
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.play().catch(() => {})
    },
    busy() {
      return pending.length > 0 || instances.length > 0 || overlays.length > 0 || labels.length > 0 || sounds.size > 0
    },
    clear() {
      const wasPaused = paused
      paused = false
      pending = []
      instances = []
      for (const overlay of overlays) if (overlay.kind === 'video') overlay.element.pause()
      overlays = []
      labels = []
      if (wasPaused) resumeAllSounds()
      for (const handle of [...sounds]) handle.stop()
      sounds.clear()
    },
  }
}
