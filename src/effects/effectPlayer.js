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
// Animations drawn by code (coins, illumination, fireball, …) come from
// animations.js. Imported files are placed by the placement saved with them
// (src/library/placement.js: which point on the hand, its height in palm
// lengths, whether it follows the hand; on a finger the middle of its bottom
// edge goes on the point, elsewhere its centre). Video files (WebM, MP4) play once to their end. Animated images
// (animated PNG, GIF, animated WebP) play their frames once from the first,
// at their own timing (animatedImage.js); a still image shows for 1.5 s and
// fades. Lottie files are not drawn yet. Audio plays through the Web Audio API
// (audioEngine.js), so it starts the instant the spell is cast.
import { PROCEDURAL_ANIMATIONS, placementOf } from './animations.js'
import { anchorPoint } from '../tracking/landmarks.js'
import { previewKind } from '../library/formats.js'
import { fingerOf, pivotFor } from '../library/placement.js'
import { decodedImage, frameAt, loadAnimatedImage } from './animatedImage.js'
import { pauseAllSounds, playSound as startSound, resumeAllSounds } from './audioEngine.js'

const IMAGE_SECONDS = 1.5 // how long a still image shows
const NO_HAND_PALM = 0.12 // without a hand, a palm length is taken as this share of the canvas height

// Starts decoding an imported animated image now, so it's ready when cast.
// Returns a promise that settles when it is.
export function preloadAnimation(animation) {
  if (animation?.url && !animation.procedural && previewKind('animations', animation) === 'image') {
    return loadAnimatedImage(animation.url).catch(() => {})
  }
  return Promise.resolve()
}

// The palm length (wrist to the base of the middle finger) in canvas pixels.
const palmOf = (points, map) => {
  const [ax, ay] = map(points[0])
  const [bx, by] = map(points[9])
  return Math.hypot(bx - ax, by - ay)
}
const LABEL_SECONDS = 1.2

export function createEffectPlayer() {
  let instances = [] // procedural animations playing
  let overlays = [] // imported files playing: { kind, element | decoded, placement, x, y, palm, age, life, failed }
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

  // The four joints (knuckle to tip) of the finger an anchor is on, in canvas
  // pixels; for "slightly lower" the finger ends at its last joint. Null
  // between fingers and on the palm.
  const FINGER_JOINTS = { thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] }
  const fingerJoints = (points, map, anchor) => {
    const finger = fingerOf(anchor)
    if (!finger) return null
    const [a, b, c, d] = FINGER_JOINTS[finger]
    return (anchor.endsWith('Low') ? [a, a, b, c] : [a, b, c, d]).map((i) => map(points[i]))
  }

  function startAnimation(animation, x, y, ctx, finger, palm) {
    if (!animation) return
    const procedural = PROCEDURAL_ANIMATIONS[animation.procedural]
    const placement = placementOf(animation)
    if (procedural) {
      // Its own design is sized to the canvas; the placement's scale enlarges
      // or shrinks it.
      const instance = procedural.create(x, y, ctx.canvas.height * placement.scale, ctx.canvas.width)
      if (placement.follow) instance.anchor = placement.anchor
      if (instance.setFinger) {
        instance.fingerAnchor = placement.anchor
        if (finger) instance.setFinger(finger, true)
      }
      instances.push(instance)
      return
    }
    if (!animation.url) return
    const kind = previewKind('animations', animation)
    const overlay = { kind, placement, x, y, palm: palm ?? ctx.canvas.height * NO_HAND_PALM, age: 0, life: Infinity, failed: false }
    if (kind === 'video') {
      const element = document.createElement('video')
      element.src = animation.url
      element.muted = true
      element.playsInline = true
      overlay.element = element
      element.addEventListener('error', () => (overlay.failed = true))
      element.play().catch(() => (overlay.failed = true))
      overlays.push(overlay)
    } else if (kind === 'image') {
      // Its clock starts once the frames are decoded (usually already, from
      // preloadAnimation), so it always plays from the first frame.
      const ready = decodedImage(animation.url)
      if (ready) {
        overlay.decoded = ready
        overlay.life = ready.duration ?? IMAGE_SECONDS
        overlays.push(overlay)
        return
      }
      overlay.loading = true
      loadAnimatedImage(animation.url).then(
        (decoded) => {
          overlay.decoded = decoded
          overlay.life = decoded.duration ?? IMAGE_SECONDS
          overlay.loading = false
        },
        () => (overlay.failed = true),
      )
      overlays.push(overlay)
    }
  }

  // The size and top-left corner of an overlay, from its placement.
  function boxOf(overlay, width, height) {
    const tall = overlay.placement.size * overlay.palm
    const wide = (width / height) * tall
    const top = pivotFor(overlay.placement.anchor) === 'bottom' ? overlay.y - tall : overlay.y - tall / 2
    return [overlay.x - wide / 2, top, wide, tall]
  }

  return {
    cast({ animation, audio, points, map, x, y, label, sound = true }) {
      const { anchor } = placementOf(animation)
      if (points && map) [x, y] = map(anchorPoint(points, anchor))
      preloadAnimation(animation)
      pending.push({ animation, x, y, finger: points && map ? fingerJoints(points, map, anchor) : null, palm: points && map ? palmOf(points, map) : null })
      if (sound) playSound(audio)
      if (label) labels.push({ text: label, x, y, age: 0 })
    },
    follow(points, map) {
      for (const instance of instances) {
        if (!instance.anchor) continue // stays where it was cast
        instance.setPosition(...map(anchorPoint(points, instance.anchor)))
        const joints = instance.setFinger && fingerJoints(points, map, instance.fingerAnchor)
        if (joints) instance.setFinger(joints)
      }
      // Imported files that follow the hand: ease towards the anchor, and
      // keep their size in step with the hand's.
      for (const overlay of overlays) {
        if (!overlay.placement.follow) continue
        const [nx, ny] = map(anchorPoint(points, overlay.placement.anchor))
        overlay.x += (nx - overlay.x) * 0.5
        overlay.y += (ny - overlay.y) * 0.5
        overlay.palm += (palmOf(points, map) - overlay.palm) * 0.3
      }
    },
    update(dt) {
      if (paused) return
      for (const instance of instances) instance.update(dt)
      instances = instances.filter((instance) => !instance.done)
      for (const overlay of overlays) if (!overlay.loading) overlay.age += dt
      overlays = overlays.filter((overlay) => {
        const done = overlay.age > overlay.life || overlay.failed || (overlay.kind === 'video' && overlay.element.ended)
        if (done && overlay.kind === 'video') overlay.element.pause()
        return !done
      })
      for (const label of labels) label.age += dt
      labels = labels.filter((label) => label.age < LABEL_SECONDS)
    },
    draw(ctx) {
      for (const { animation, x, y, finger, palm } of pending) startAnimation(animation, x, y, ctx, finger, palm)
      pending = []
      for (const overlay of overlays) {
        if (overlay.kind === 'video') {
          const { element } = overlay
          if (!element.videoWidth || !element.videoHeight) continue
          ctx.drawImage(element, ...boxOf(overlay, element.videoWidth, element.videoHeight))
        } else if (overlay.decoded) {
          const { decoded } = overlay
          ctx.save()
          // A still image fades out at the end; an animation ends by itself.
          if (decoded.duration == null) ctx.globalAlpha = Math.min(1, (overlay.life - overlay.age) * 2)
          ctx.drawImage(frameAt(decoded, overlay.age), ...boxOf(overlay, decoded.width, decoded.height))
          ctx.restore()
        }
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
