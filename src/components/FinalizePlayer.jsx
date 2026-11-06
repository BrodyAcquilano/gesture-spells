import { useEffect, useRef, useState } from 'react'
import { createEffectPlayer, preloadAnimation } from '../effects/effectPlayer.js'
import { audioContext, preloadSound, setExtraOutput } from '../effects/audioEngine.js'
import { mirroredMapper } from '../tracking/drawHand.js'
import { recordingVideoUrl, saveExportFile } from '../storage/projectApi.js'
import { startRecording, timestampId } from '../record/videoRecorder.js'

const TAIL_SECONDS = 4 // longest wait after the video ends for effects to finish

// A <video> can be connected to Web Audio only once in its life, so its
// connection is made the first time and reused afterwards (React runs effects
// twice in development, and again whenever the recording changes).
const mediaSources = new WeakMap()
function sourceFor(audio, video) {
  let source = mediaSources.get(video)
  if (!source) {
    source = audio.createMediaElementSource(video)
    mediaSources.set(video, source)
  }
  return source
}

// Plays a recording with the spells added: the camera video (mirrored, as it
// looked live), and at each cast its spell's animation at the hand and its
// sound. Animations that follow the hand (Illumination) follow the recorded
// hand positions.
//
// Export plays the whole recording through once, in real time, while
// recording the picture and the sound (the microphone plus the effect
// sounds) into a new video: MP4 where the browser can, otherwise WebM. The
// file is saved into exports/ and offered as a download.
// showExport: false in the Record tab, which only plays recordings back.
export default function FinalizePlayer({ recording, track, casts, resolveCast, onExported, showExport = true }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const control = useRef({})
  const [state, setState] = useState({ playing: false, time: 0, exporting: false, progress: 0 })
  const duration = recording.duration

  useEffect(() => {
    for (const cast of casts) {
      preloadSound(resolveCast(cast).audio?.url)
      preloadAnimation(resolveCast(cast).animation)
    }
  }, [casts, resolveCast])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const player = createEffectPlayer()
    const audio = audioContext()
    // The video's own sound goes through Web Audio, so an export can record it.
    const source = sourceFor(audio, video)
    source.connect(audio.destination)
    let lastTime = 0
    let last = performance.now()
    let frame = 0
    let reported = 0
    let ended = false

    function trackAt(t) {
      // The recorded hand frame at or just before time t (binary search).
      let lo = 0
      let hi = track.length - 1
      if (hi < 0 || track[0].t > t) return null
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (track[mid].t <= t) lo = mid
        else hi = mid - 1
      }
      return t - track[lo].t < 0.3 ? track[lo] : null
    }

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = video.videoWidth || recording.width || 1280
      const h = video.videoHeight || recording.height || 720
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const map = mirroredMapper(w, h)
      const t = video.currentTime
      if (t < lastTime - 0.05 || t > lastTime + 0.5) {
        player.clear() // jumped (seek): don't fire everything in between
      } else if (!video.paused) {
        for (const cast of casts) {
          if (cast.t > lastTime && cast.t <= t) {
            const { animation, audio: sound } = resolveCast(cast)
            player.cast({ animation, audio: sound, points: cast.points, map })
          }
        }
      }
      lastTime = t
      const hand = trackAt(t)
      if (hand) player.follow(hand.points, map)
      player.update(video.paused && !ended ? 0 : dt)

      ctx.setTransform(-1, 0, 0, 1, w, 0)
      ctx.drawImage(video, 0, 0, w, h)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      player.draw(ctx)

      if (now - reported > 200) {
        reported = now
        setState((s) => ({ ...s, time: t, playing: !video.paused }))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const seekTo = (t) =>
      new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true })
        video.currentTime = t
      })

    control.current = {
      toggle() {
        if (audio.state === 'suspended') audio.resume()
        if (video.paused) {
          if (video.ended || video.currentTime >= duration - 0.05) video.currentTime = 0
          video.play()
        } else video.pause()
      },
      seek(t) {
        video.currentTime = t
      },
      async exportVideo() {
        if (audio.state === 'suspended') await audio.resume()
        video.pause()
        await seekTo(0)
        player.clear()
        lastTime = 0
        const destination = audio.createMediaStreamDestination()
        source.connect(destination)
        setExtraOutput(destination)
        const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...destination.stream.getAudioTracks()])
        const recorder = startRecording(stream, { videoBitsPerSecond: 8_000_000 })
        setState((s) => ({ ...s, exporting: true, progress: 0 }))
        const progress = setInterval(() => setState((s) => ({ ...s, progress: Math.min(1, video.currentTime / duration) })), 250)
        try {
          await video.play()
          await new Promise((resolve) => video.addEventListener('ended', resolve, { once: true }))
          // Let the last effects finish instead of cutting them off.
          ended = true
          const waitStart = performance.now()
          while (player.busy() && performance.now() - waitStart < TAIL_SECONDS * 1000) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          ended = false
          const { blob, ext } = await recorder.stop()
          const name = `${timestampId(slug(recording.name))}.${ext}`
          const path = await saveExportFile(name, blob)
          onExported({ name, path, url: URL.createObjectURL(blob), ext })
        } catch (error) {
          recorder.stop().catch(() => {})
          onExported({ error: error.message })
        } finally {
          clearInterval(progress)
          setExtraOutput(null)
          source.disconnect(destination)
          setState((s) => ({ ...s, exporting: false, progress: 0 }))
        }
      },
    }

    return () => {
      cancelAnimationFrame(frame)
      player.clear()
      video.pause()
      source.disconnect()
      control.current = {}
    }
  }, [recording, track, casts, resolveCast, duration, onExported])

  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <div className="finalize-player">
      <video ref={videoRef} className="caster-video" src={recordingVideoUrl(recording.id)} playsInline preload="auto" />
      <canvas ref={canvasRef} className="caster-canvas" />
      <div className="finalize-controls">
        <button className="neon-button play-button" onClick={() => control.current.toggle?.()} disabled={state.exporting}>
          {state.playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={Math.min(state.time, duration)}
          disabled={state.exporting}
          onChange={(event) => control.current.seek?.(Number(event.target.value))}
          aria-label="Position"
        />
        <span className="playback-label">
          {clock(state.time)} / {clock(duration)}
        </span>
        {showExport && (
          <button className="neon-button" onClick={() => control.current.exportVideo?.()} disabled={state.exporting}>
            {state.exporting ? `Exporting… ${Math.round(state.progress * 100)}%` : 'Export video'}
          </button>
        )}
      </div>
    </div>
  )
}

function slug(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'export'
  )
}
