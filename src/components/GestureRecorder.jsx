import { useRef, useState } from 'react'
import { useHandCamera } from '../tracking/useHandCamera.js'
import { drawHand, mirroredMapper } from '../tracking/drawHand.js'
import { trimRecording } from '../gestures/trim.js'

const COUNTDOWN_MS = 3000
const RECORD_MS = 2500
export const SUGGESTED_EXAMPLES = 3

// Records examples of a spell's gesture: a 3-second countdown, then 2.5 s of
// hand landmarks, trimmed to the part where the hand moved. Each recording is
// one example; three to five make recognition reliable.
export default function GestureRecorder({ exampleCount, onSave, onClose }) {
  // The loop reads and changes `phase` every frame; React state only mirrors
  // what the overlay needs to show.
  const phase = useRef({ name: 'ready' })
  const [view, setView] = useState({ name: 'ready', count: 0, message: '', ok: true })

  const { videoRef, canvasRef, status, error, start } = useHandCamera(({ ctx, w, h, hands, now, fresh }) => {
    const p = phase.current
    const map = mirroredMapper(w, h)
    for (const hand of hands) drawHand(ctx, hand.points, map, p.name === 'recording' ? 'rgba(255, 220, 90, 0.9)' : undefined)

    if (p.name === 'countdown') {
      const left = Math.ceil((p.until - now) / 1000)
      if (left !== p.shown) {
        p.shown = left
        setView((v) => ({ ...v, name: 'countdown', count: left }))
      }
      if (now >= p.until) {
        phase.current = { name: 'recording', start: now, until: now + RECORD_MS, frames: [], missed: 0, aspect: w / h }
        setView((v) => ({ ...v, name: 'recording' }))
      }
    } else if (p.name === 'recording') {
      if (fresh) {
        const hand = hands[0]
        if (hand) p.frames.push({ t: now - p.start, label: hand.label, points: hand.points })
        else p.missed++
      }
      // Progress bar along the bottom.
      ctx.fillStyle = 'rgba(255, 220, 90, 0.9)'
      ctx.fillRect(0, h - 10, (w * (now - p.start)) / RECORD_MS, 10)
      if (now >= p.until) {
        phase.current = { name: 'ready' }
        const result = trimRecording(p.frames, p.aspect, p.missed)
        if (result.error) {
          setView({ name: 'ready', count: 0, message: result.error, ok: false })
        } else {
          onSave(result.example)
          setView({
            name: 'ready',
            count: 0,
            message: `Example saved (${(result.example.duration / 1000).toFixed(2)} s of movement).`,
            ok: true,
          })
        }
      }
    }
  })

  function beginCountdown() {
    phase.current = { name: 'countdown', until: performance.now() + COUNTDOWN_MS, shown: null }
    setView({ name: 'countdown', count: 3, message: '', ok: true })
  }

  const running = status === 'running'
  return (
    <div className="caster">
      <video ref={videoRef} className="caster-video" playsInline muted />
      <canvas ref={canvasRef} className="caster-canvas" />

      {!running && (
        <div className="caster-overlay">
          <p className="caster-title">Record this spell&apos;s gesture</p>
          <Instructions />
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button className="neon-button" onClick={start} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading camera and hand model…' : 'Start camera'}
            </button>
            <button className="neon-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {running && view.name === 'countdown' && <div className="countdown">{view.count}</div>}
      {running && view.name === 'recording' && <div className="go-banner">GO, do the gesture!</div>}

      {running && view.name === 'ready' && (
        <div className="recorder-panel">
          <p>
            <strong>
              {exampleCount} of {SUGGESTED_EXAMPLES}+ examples
            </strong>{' '}
            <span className="muted">· 3 to 5 make recognition reliable</span>
          </p>
          {view.message && <p className={view.ok ? 'ok' : 'error'}>{view.message}</p>}
          <div className="button-row">
            <button className="neon-button" onClick={beginCountdown}>
              {exampleCount === 0 ? 'Record example' : 'Record another'}
            </button>
            <button className="neon-button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Instructions() {
  return (
    <ol className="instructions">
      <li>Sit about an arm&apos;s length from the camera in good light, with your whole hand in view, palm facing the camera.</li>
      <li>Press Record. During the 3-second countdown, hold your hand still and open, fingers relaxed.</li>
      <li>
        At <strong>GO</strong>, do the gesture once. For a pinch: bring your thumb tip and index fingertip firmly
        together, quickly, and <strong>keep holding the pinch</strong> until the gold bar finishes.
      </li>
      <li>Record 3 to 5 examples. Vary them a little: slightly faster, slower, nearer, further.</li>
    </ol>
  )
}
