import { useEffect, useRef, useState } from 'react'
import { HAND_CONNECTIONS, loadHandTracker } from '../tracking/handTracker.js'
import { createPinchDetector, pinchPoint } from '../tracking/pinch.js'
import { createSparks } from '../effects/sparks.js'
import { playSparkSound } from '../effects/sparkSound.js'

// Test spell: live camera, hand tracking, and a pinch that throws sparks.
//
// The per-frame work (track, detect pinches, move particles, draw) runs in a
// requestAnimationFrame loop that lives in refs, outside React. React state is
// only used for the buttons and a status line updated twice a second, so the
// page does not re-render 30–60 times a second.
export default function PinchCaster() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const runRef = useRef(null) // { stream, frame, audio } while running
  const [status, setStatus] = useState('idle') // idle | loading | running | error
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ fps: 0, hands: 0, casts: 0 })

  function stop() {
    const run = runRef.current
    if (!run) return
    cancelAnimationFrame(run.frame)
    run.stream.getTracks().forEach((track) => track.stop())
    run.audio.close()
    runRef.current = null
  }

  useEffect(() => stop, [])

  async function start() {
    setStatus('loading')
    setError('')
    // Created inside the click so the browser lets it make sound.
    const audio = new AudioContext()
    let stream
    try {
      const [tracker, cameraStream] = await Promise.all([
        loadHandTracker(),
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
      ])
      stream = cameraStream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      runRef.current = { stream, audio, frame: 0 }
      setStatus('running')
      loop(tracker, video, canvasRef.current, audio)
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop())
      audio.close()
      runRef.current = null
      setStatus('error')
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in the address bar and try again.'
          : `Could not start: ${err.message}`,
      )
    }
  }

  function loop(tracker, video, canvas, audio) {
    const ctx = canvas.getContext('2d')
    const sparks = createSparks()
    const detectors = new Map() // one pinch detector per hand ("Left"/"Right")
    let lastVideoTime = -1
    let lastFrame = performance.now()
    let hands = []
    let casts = 0
    let frames = 0
    let statsTime = lastFrame

    function frame(now) {
      const run = runRef.current
      if (!run) return
      const dt = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrame = now
      const w = video.videoWidth
      const h = video.videoHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      // Only run the model when the camera has delivered a new frame.
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const result = tracker.detectForVideo(video, now)
        hands = result.landmarks.map((landmarks, i) => ({
          landmarks,
          label: result.handedness[i]?.[0]?.categoryName ?? String(i),
        }))
        frames++
      }

      // Draw the camera mirrored, so moving your hand right moves it right
      // on screen. Landmark x values are mirrored the same way: x → 1 - x.
      ctx.setTransform(-1, 0, 0, 1, w, 0)
      ctx.drawImage(video, 0, 0, w, h)
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      const seen = new Set()
      for (const hand of hands) {
        seen.add(hand.label)
        if (!detectors.has(hand.label)) detectors.set(hand.label, createPinchDetector())
        const pinch = detectors.get(hand.label).update(hand.landmarks, w, h)
        const point = pinchPoint(hand.landmarks)
        const px = (1 - point.x) * w
        const py = point.y * h
        if (pinch.started) {
          sparks.burst(px, py)
          playSparkSound(audio)
          casts++
        } else if (pinch.pinching) {
          sparks.trail(px, py)
        }
        drawHand(ctx, hand.landmarks, w, h, pinch.pinching)
      }
      // A hand that left the frame should not stay "pinching".
      for (const [label, detector] of detectors) if (!seen.has(label)) detector.reset()

      sparks.update(dt)
      sparks.draw(ctx)

      if (now - statsTime > 500) {
        setStats({ fps: Math.round((frames * 1000) / (now - statsTime)), hands: hands.length, casts })
        frames = 0
        statsTime = now
      }
      run.frame = requestAnimationFrame(frame)
    }
    runRef.current.frame = requestAnimationFrame(frame)
  }

  function handleStop() {
    stop()
    setStatus('idle')
    setStats({ fps: 0, hands: 0, casts: 0 })
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div className="caster">
      <video ref={videoRef} className="caster-video" playsInline muted />
      <canvas ref={canvasRef} className="caster-canvas" />
      {status !== 'running' && (
        <div className="caster-overlay">
          <p className="caster-title">Test spell: pinch to cast ✨</p>
          <p className="muted">
            Touch your thumb and index finger together to throw sparks. Hold the pinch and move to
            leave a trail.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="neon-button" onClick={start} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading camera and hand model…' : 'Start camera'}
          </button>
        </div>
      )}
      {status === 'running' && (
        <div className="caster-hud">
          <span>{stats.fps} fps</span>
          <span>{stats.hands} hand{stats.hands === 1 ? '' : 's'}</span>
          <span>{stats.casts} cast{stats.casts === 1 ? '' : 's'}</span>
          <button className="neon-button small" onClick={handleStop}>
            Stop
          </button>
        </div>
      )}
    </div>
  )
}

function drawHand(ctx, landmarks, w, h, pinching) {
  const point = (lm) => [(1 - lm.x) * w, lm.y * h]
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = pinching ? 'rgba(255, 220, 90, 0.9)' : 'rgba(0, 240, 255, 0.7)'
  ctx.shadowColor = ctx.strokeStyle
  ctx.shadowBlur = 8
  ctx.beginPath()
  for (const { start, end } of HAND_CONNECTIONS) {
    ctx.moveTo(...point(landmarks[start]))
    ctx.lineTo(...point(landmarks[end]))
  }
  ctx.stroke()
  ctx.fillStyle = '#ff2bd6'
  for (const lm of landmarks) {
    const [x, y] = point(lm)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
