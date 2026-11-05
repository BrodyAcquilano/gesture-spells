import { useEffect, useRef } from 'react'
import { createSparks } from '../effects/sparks.js'

// Plays the sparks animation on a loop, bursting from the centre once a second.
export default function SparksPreview() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const sparks = createSparks()
    let frame = 0
    let last = performance.now()
    let sinceBurst = Infinity

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { clientWidth: w, clientHeight: h } = canvas
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      sinceBurst += dt
      if (sinceBurst > 1.1) {
        sparks.burst(w / 2, h / 2)
        sinceBurst = 0
      }
      sparks.update(dt)
      ctx.clearRect(0, 0, w, h)
      sparks.draw(ctx)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={canvasRef} className="fill-canvas" />
}
