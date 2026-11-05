import { useEffect, useRef } from 'react'
import { drawHand } from '../tracking/drawHand.js'
import { handPoint } from '../tracking/landmarks.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'

const PAUSE_BEFORE = 0.6 // seconds holding the first pose
const PAUSE_AFTER = 1.8 // seconds holding the last pose while the animation plays

// Replays a spell's recorded examples as a moving hand skeleton, one after
// another, and fires the spell's animation where the gesture ends, the way
// it would when cast live. Silent: the sound has its own player below.
export default function GesturePlayback({ gesture, animation }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const player = createEffectPlayer()
    const examples = gesture.examples
    let index = 0
    let clock = 0 // seconds into the current example's cycle
    let fired = false
    let frame = 0
    let last = performance.now()

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { clientWidth: cw, clientHeight: ch } = canvas
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      const example = examples[index % examples.length]
      const duration = example.duration / 1000
      clock += dt
      if (clock > PAUSE_BEFORE + duration + PAUSE_AFTER) {
        clock = 0
        fired = false
        index++
      }

      // Fit the recording's aspect ratio inside the canvas, mirrored like the camera.
      const width = Math.min(cw, ch * example.aspect)
      const height = width / example.aspect
      const left = (cw - width) / 2
      const top = (ch - height) / 2
      const map = ([x, y]) => [left + (1 - x) * width, top + y * height]

      const t = Math.min(duration, Math.max(0, clock - PAUSE_BEFORE)) * 1000
      let current = example.frames[0]
      for (const f of example.frames) {
        if (f.t <= t) current = f
        else break
      }

      if (!fired && clock >= PAUSE_BEFORE + duration) {
        fired = true
        const [x, y] = map(handPoint(current.points))
        player.cast({ animation, x, y, sound: false })
      }
      player.update(dt)

      ctx.clearRect(0, 0, cw, ch)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'
      ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)
      drawHand(ctx, current.points, map, fired ? 'rgba(255, 220, 90, 0.9)' : undefined)
      player.draw(ctx)
      ctx.fillStyle = '#8a8cb3'
      ctx.font = '13px "Cascadia Code", Consolas, monospace'
      ctx.fillText(`example ${(index % examples.length) + 1} of ${examples.length}`, left + 10, top + 20)

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      player.clear()
    }
  }, [gesture, animation])

  return <canvas ref={canvasRef} className="fill-canvas" />
}
