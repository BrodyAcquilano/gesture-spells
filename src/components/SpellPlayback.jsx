import { useEffect, useMemo, useRef, useState } from 'react'
import { drawHand } from '../tracking/drawHand.js'
import { handPoint } from '../tracking/landmarks.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'

const LEAD_IN = 0.3 // seconds showing the first pose before the hand moves

// Plays a whole spell with one Play/Pause button: the recorded hand gesture,
// then, at the moment it would cast, the animation and the audio together.
// Nothing is cut short: playback ends when the longest part has finished,
// whether that is the gesture, the animation or the sound. Pause freezes all
// of them. Each new play uses the next recorded example. Any part can be
// missing; the rest still plays.
export default function SpellPlayback({ gesture, animation, audio }) {
  const canvasRef = useRef(null)
  const control = useRef({ toggle: () => {} })
  const [status, setStatus] = useState('idle') // idle | playing | paused
  const examples = useMemo(() => gesture?.examples ?? [], [gesture])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const player = createEffectPlayer()
    let index = 0
    let state = { phase: 'idle' } // idle | gesture | effects
    let paused = false
    let frame = 0
    let last = performance.now()

    control.current.toggle = () => {
      if (state.phase === 'idle') {
        state = examples.length ? { phase: 'gesture', clock: 0 } : { phase: 'effects', cast: false }
        setStatus('playing')
      } else if (paused) {
        paused = false
        player.resume()
        setStatus('playing')
      } else {
        paused = true
        player.pause()
        setStatus('paused')
      }
    }

    function layout(aspect) {
      const { width: cw, height: ch } = canvas
      const width = Math.min(cw, ch * aspect)
      const height = width / aspect
      const left = (cw - width) / 2
      const top = (ch - height) / 2
      return { width, height, left, top, map: ([x, y]) => [left + (1 - x) * width, top + y * height] }
    }

    function poseAt(example, ms) {
      let current = example.frames[0]
      for (const f of example.frames) {
        if (f.t <= ms) current = f
        else break
      }
      return current
    }

    function tick(now) {
      const dt = paused ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now
      const { clientWidth: cw, clientHeight: ch } = canvas
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      ctx.clearRect(0, 0, cw, ch)

      const example = examples.length ? examples[index % examples.length] : null
      const box = example ? layout(example.aspect) : null

      if (!paused) {
        if (state.phase === 'gesture') {
          state.clock += dt
          if ((state.clock - LEAD_IN) * 1000 >= example.duration) {
            // The cast moment: animation and audio start together at the hand.
            const [x, y] = box.map(handPoint(example.frames[example.frames.length - 1].points))
            player.cast({ animation, audio, x, y })
            state = { phase: 'effects', cast: true }
          }
        } else if (state.phase === 'effects' && !state.cast) {
          player.cast({ animation, audio, x: cw / 2, y: ch / 2 })
          state.cast = true
        } else if (state.phase === 'effects' && !player.busy()) {
          state = { phase: 'idle' }
          if (examples.length) index++
          setStatus('idle')
        }
      }
      player.update(dt)

      if (example) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'
        ctx.strokeRect(box.left + 0.5, box.top + 0.5, box.width - 1, box.height - 1)
        let pose = example.frames[0]
        if (state.phase === 'gesture') pose = poseAt(example, (state.clock - LEAD_IN) * 1000)
        else if (state.phase === 'effects') pose = example.frames[example.frames.length - 1]
        drawHand(ctx, pose.points, box.map, state.phase === 'effects' ? 'rgba(255, 220, 90, 0.9)' : undefined)
      }
      player.draw(ctx)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const handle = control.current
    return () => {
      cancelAnimationFrame(frame)
      player.clear()
      handle.toggle = () => {}
      setStatus('idle')
    }
  }, [examples, animation, audio])

  return (
    <div className="playback">
      <canvas ref={canvasRef} className="fill-canvas" />
      <div className="playback-bar">
        <button className="neon-button play-button" onClick={() => control.current.toggle()}>
          {status === 'playing' ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>
    </div>
  )
}
