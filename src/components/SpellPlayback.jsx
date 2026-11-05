import { useEffect, useMemo, useRef, useState } from 'react'
import { drawHand } from '../tracking/drawHand.js'
import { arrivalTime } from '../gestures/features.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'
import { preloadSound } from '../effects/audioEngine.js'

const LEAD_IN = 0.15 // seconds showing the first pose before the hand moves
const GAP = 0.4 // seconds between one example and the next

// Plays a whole spell with one Play/Pause button, looping through every
// recorded example until paused. For each example: the hand gesture, and at
// the moment it would cast (when the hand arrives at its final pose, e.g. the
// fingers touch) the animation and the audio together, at the animation's
// place on the hand. The next example starts only once the longest part has
// finished, so nothing is cut short. Pause freezes all of it. A spell without
// a gesture loops its animation and audio.
export default function SpellPlayback({ gesture, animation, audio }) {
  const canvasRef = useRef(null)
  const control = useRef({ toggle: () => {} })
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0) // which example is showing
  const examples = useMemo(() => gesture?.examples ?? [], [gesture])
  // When each example reaches its final pose: the cast moment.
  const castTimes = useMemo(() => examples.map((e) => arrivalTime(e.frames, e.aspect)), [examples])

  useEffect(() => {
    preloadSound(audio?.url)
  }, [audio])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const player = createEffectPlayer()
    let index = 0
    let state = { phase: 'idle' } // idle | gesture | effects | gap
    let paused = false
    let frame = 0
    let last = performance.now()


    const begin = () => {
      state = examples.length ? { phase: 'gesture', clock: 0, cast: false } : { phase: 'effects', cast: false }
    }

    control.current.toggle = () => {
      if (state.phase === 'idle') {
        begin()
        setPlaying(true)
      } else if (paused) {
        paused = false
        player.resume()
        setPlaying(true)
      } else {
        paused = true
        player.pause()
        setPlaying(false)
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
      let pose = example.frames[0]
      for (const f of example.frames) {
        if (f.t <= ms) pose = f
        else break
      }
      return pose
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

      const example = examples.length ? examples[index] : null
      const box = example ? layout(example.aspect) : null

      if (!paused) {
        if (state.phase === 'gesture') {
          state.clock += dt
          const ms = (state.clock - LEAD_IN) * 1000
          if (!state.cast && ms >= castTimes[index]) {
            // The cast moment: animation and audio start together at the hand.
            player.cast({ animation, audio, points: poseAt(example, ms).points, map: box.map })
            state.cast = true
          }
          if (ms >= example.duration) state = { phase: 'effects', cast: true }
        } else if (state.phase === 'effects' && !state.cast) {
          player.cast({ animation, audio, x: cw / 2, y: ch / 2 })
          state.cast = true
        } else if (state.phase === 'effects' && !player.busy()) {
          state = { phase: 'gap', clock: 0 }
        } else if (state.phase === 'gap') {
          state.clock += dt
          if (state.clock >= GAP) {
            if (examples.length) {
              index = (index + 1) % examples.length
              setCurrent(index)
            }
            begin()
          }
        }
      }
      player.update(dt)

      if (example) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'
        ctx.strokeRect(box.left + 0.5, box.top + 0.5, box.width - 1, box.height - 1)
        let pose = example.frames[0]
        if (state.phase === 'gesture') pose = poseAt(example, (state.clock - LEAD_IN) * 1000)
        else if (state.phase === 'effects' || state.phase === 'gap') pose = example.frames[example.frames.length - 1]
        drawHand(ctx, pose.points, box.map, state.cast ? 'rgba(255, 220, 90, 0.9)' : undefined)
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
      setPlaying(false)
    }
  }, [examples, castTimes, animation, audio])

  return (
    <div className="playback">
      <canvas ref={canvasRef} className="fill-canvas" />
      <div className="playback-bar">
        <button className="neon-button play-button" onClick={() => control.current.toggle()}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        {examples.length > 0 && (
          <span className="playback-label">
            Example {current + 1} of {examples.length}
          </span>
        )}
      </div>
    </div>
  )
}
