import { useEffect, useRef } from 'react'
import { PROCEDURAL_ANIMATIONS } from '../effects/animations.js'

const PAUSE = 0.5 // seconds between plays

// Loops an animation that is drawn by code: plays it in the middle of the
// view (the fireball a little low, as if from a hand), waits for it to finish
// completely, pauses briefly, and plays it again.
export default function ProceduralPreview({ name }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const animation = PROCEDURAL_ANIMATIONS[name]
    let instance = null
    let wait = 0
    let frame = 0
    let last = performance.now()

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { clientWidth: w, clientHeight: h } = canvas
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      if (!instance || instance.done) {
        wait += dt
        if (wait > PAUSE || !instance) {
          wait = 0
          const y = animation.anchor === 'palm' ? h * 0.7 : h / 2
          instance = animation.create(w / 2, y, h, w)
        }
      }
      instance.update(dt)
      ctx.clearRect(0, 0, w, h)
      instance.draw(ctx)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [name])

  return <canvas ref={canvasRef} className="fill-canvas" />
}
