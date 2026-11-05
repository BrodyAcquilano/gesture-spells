import { useCallback, useEffect, useRef, useState } from 'react'
import { loadHandTracker } from './handTracker.js'
import { toPoints } from './landmarks.js'

// Camera + hand tracking for a component. Returns refs for a <video> (kept
// hidden) and a <canvas>, plus start/stop. While running, every animation
// frame draws the camera mirrored onto the canvas and calls
//   onFrame({ ctx, w, h, hands, now, dt, fresh })
// hands: [{ points, label }]   label: 'Left' | 'Right'
// fresh: true when the camera delivered a new frame and the model ran on it
// now:   milliseconds (performance.now), dt: seconds since the last call
//
// The loop lives outside React state on purpose: it runs 30–60 times a second.
export function useHandCamera(onFrame) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const runRef = useRef(null) // { stream, frame } while running
  const onFrameRef = useRef(onFrame)
  const [status, setStatus] = useState('idle') // idle | loading | running | error
  const [error, setError] = useState('')

  useEffect(() => {
    onFrameRef.current = onFrame
  })

  const release = useCallback(() => {
    const run = runRef.current
    runRef.current = null
    if (!run) return
    run.stopped = true
    cancelAnimationFrame(run.frame)
    run.stream?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => release, [release])

  const stop = useCallback(() => {
    release()
    setStatus('idle')
  }, [release])

  const start = useCallback(async () => {
    release()
    const run = { stream: null, frame: 0, stopped: false }
    runRef.current = run
    setStatus('loading')
    setError('')
    try {
      const [tracker, stream] = await Promise.all([
        loadHandTracker(),
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
      ])
      run.stream = stream
      if (run.stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      setStatus('running')
      loop(run, tracker, video, canvasRef.current, onFrameRef)
    } catch (err) {
      if (run.stopped) return
      release()
      setStatus('error')
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in the address bar and try again.'
          : `Could not start the camera: ${err.message}`,
      )
    }
  }, [release])

  return { videoRef, canvasRef, status, error, start, stop }
}

function loop(run, tracker, video, canvas, onFrameRef) {
  const ctx = canvas.getContext('2d')
  let lastVideoTime = -1
  let last = performance.now()
  let hands = []

  function tick(now) {
    if (run.stopped) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const w = video.videoWidth
    const h = video.videoHeight
    if (w && h) {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      // Only run the model when the camera has delivered a new frame.
      let fresh = false
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const result = tracker.detectForVideo(video, now)
        hands = result.landmarks.map((landmarks, i) => ({
          points: toPoints(landmarks),
          label: result.handedness[i]?.[0]?.categoryName ?? 'Right',
        }))
        fresh = true
      }
      // Mirrored, so moving your hand right moves it right on screen.
      ctx.setTransform(-1, 0, 0, 1, w, 0)
      ctx.drawImage(video, 0, 0, w, h)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      onFrameRef.current({ ctx, w, h, hands, now, dt, fresh })
    }
    run.frame = requestAnimationFrame(tick)
  }
  run.frame = requestAnimationFrame(tick)
}
