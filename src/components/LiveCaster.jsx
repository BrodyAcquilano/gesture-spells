import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../library/DataContext.js'
import { useHandCamera } from '../tracking/useHandCamera.js'
import { drawHand, mirroredMapper } from '../tracking/drawHand.js'
import { buildRecognizer } from '../gestures/recognizer.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'
import { preloadSound } from '../effects/audioEngine.js'
import { startRecording, timestampId } from '../record/videoRecorder.js'

const HISTORY_MS = 4000
const COOLDOWN_MS = 1000

// Live camera with recording.
//
// recognize = true (Spellbook mode): recognises the spellbook's gestures and
// plays each spell's animation (at the hand) and audio when it is cast.
// recognize = false (Editing mode): just the camera and hand tracking.
//
// Record saves, into recordings/ (local only):
//   the camera video with the microphone, as it came from the camera, with
//     no effects drawn on it (Finalize adds them)
//   the hand positions in every frame (track)
//   each spell cast: when, which spell, and where the hand was
// While recording, effects still show but their sounds are muted, so the
// microphone doesn't pick them up and Finalize doesn't add them twice.
export default function LiveCaster({ recognize = true }) {
  const { spells, findFile, saveRecording } = useData()
  const recognizer = useMemo(() => buildRecognizer(recognize ? spells : []), [spells, recognize])
  // Decode every spell's sound now, so casting plays it without delay.
  useEffect(() => {
    for (const spell of spells) preloadSound(findFile('audio', spell.audioId)?.url)
  }, [spells, findFile])
  const live = useRef(null) // per-run state the loop changes every frame
  const recording = useRef(null) // { handle, track, casts, size } while recording
  const [stats, setStats] = useState({ fps: 0, hands: 0, casts: 0, best: null, last: '' })
  const [recordState, setRecordState] = useState({ phase: 'idle', seconds: 0, message: '' }) // idle | recording | saving

  const { videoRef, canvasRef, status, error, hasMicrophone, start, stop, getStream } = useHandCamera(
    ({ ctx, w, h, hands, now, dt, fresh }) => {
      live.current ??= { history: [], player: createEffectPlayer(), cooldown: 0, tick: 0, frames: 0, statsAt: now, casts: 0, best: null, last: '' }
      const s = live.current
      const rec = recording.current
      const hand = hands[0]
      const map = mirroredMapper(w, h)

      if (fresh) {
        s.frames++
        if (hand) {
          s.history.push({ t: now, label: hand.label, points: hand.points })
          if (rec) rec.track.push({ t: (now - rec.handle.startedAt) / 1000, label: hand.label, points: hand.points })
        } else if (s.history.length && now - s.history[s.history.length - 1].t > 300) {
          s.history = [] // the hand left; start afresh when it returns
        }
        while (s.history.length && s.history[0].t < now - HISTORY_MS) s.history.shift()
        if (rec) rec.size = { width: w, height: h }

        // Matching every other camera frame is plenty and halves the work.
        if (hand && recognizer.entries.length && now >= s.cooldown && ++s.tick % 2 === 0) {
          const { best, match } = recognizer.classify(s.history, now, w / h)
          s.best = best
          if (match) {
            const { spell } = match
            s.player.cast({
              animation: findFile('animations', spell.animationId),
              audio: findFile('audio', spell.audioId),
              points: hand.points,
              map,
              label: spell.name,
              sound: !rec,
            })
            if (rec) rec.casts.push({ t: (now - rec.handle.startedAt) / 1000, spellId: spell.id, points: hand.points })
            s.casts++
            s.last = spell.name
            s.cooldown = now + COOLDOWN_MS
            s.history = []
          }
        }
      }

      for (const each of hands) drawHand(ctx, each.points, map)
      if (hand) s.player.follow(hand.points, map)
      s.player.update(dt)
      s.player.draw(ctx)

      if (now - s.statsAt > 400) {
        setStats({ fps: Math.round((s.frames * 1000) / (now - s.statsAt)), hands: hands.length, casts: s.casts, best: s.best, last: s.last })
        if (rec) setRecordState((r) => ({ ...r, seconds: (now - rec.handle.startedAt) / 1000 }))
        s.frames = 0
        s.statsAt = now
      }
    },
    { audio: true },
  )

  function beginRecording() {
    const stream = getStream()
    if (!stream) return
    recording.current = { handle: startRecording(stream), track: [], casts: [], size: null }
    setRecordState({ phase: 'recording', seconds: 0, message: '' })
  }

  async function endRecording() {
    const rec = recording.current
    if (!rec) return
    recording.current = null
    setRecordState({ phase: 'saving', seconds: 0, message: '' })
    try {
      const { blob, mimeType, ext, duration } = await rec.handle.stop()
      const createdAt = Date.now()
      const meta = {
        id: timestampId('rec'),
        name: `Recording ${new Date(createdAt).toLocaleString()}`,
        createdAt,
        duration,
        mimeType,
        ext,
        width: rec.size?.width ?? 0,
        height: rec.size?.height ?? 0,
        recognized: recognize,
        casts: rec.casts,
      }
      await saveRecording({ blob, ext, meta, track: rec.track })
      setRecordState({ phase: 'idle', seconds: 0, message: `Saved "${meta.name}" (${duration.toFixed(1)} s, ${ext.toUpperCase()}).` })
    } catch (err) {
      setRecordState({ phase: 'idle', seconds: 0, message: `Could not save the recording: ${err.message}` })
    }
  }

  function handleStop() {
    if (recording.current) endRecording()
    live.current?.player.clear()
    live.current = null
    stop()
  }

  const castable = recognizer.entries
  const running = status === 'running'
  const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  const savedOk = recordState.message.startsWith('Saved')
  return (
    <div className="caster">
      <video ref={videoRef} className="caster-video" playsInline muted />
      <canvas ref={canvasRef} className="caster-canvas" />
      {!running && (
        <div className="caster-overlay">
          <p className="caster-title">{recognize ? 'Live casting' : 'Camera'}</p>
          {recognize &&
            (castable.length === 0 ? (
              <p className="muted">No spell has a recorded gesture yet. Go to the Spellbook tab and record one first.</p>
            ) : (
              <p className="muted">Ready to recognise: {castable.map((entry) => entry.spell.name).join(', ')}</p>
            ))}
          {error && <p className="error">{error}</p>}
          {recordState.message && <p className={savedOk ? 'ok' : 'error'}>{recordState.message}</p>}
          <button className="neon-button" onClick={start} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading camera and hand model…' : 'Start camera'}
          </button>
        </div>
      )}
      {running && (
        <div className="caster-hud">
          {recordState.phase === 'recording' ? (
            <>
              <span className="rec-dot">● REC {clock(recordState.seconds)}</span>
              <button className="neon-button small danger" onClick={endRecording}>
                ■ Stop recording
              </button>
            </>
          ) : (
            <button className="neon-button small" onClick={beginRecording} disabled={recordState.phase === 'saving'}>
              {recordState.phase === 'saving' ? 'Saving…' : '● Record'}
            </button>
          )}
          <span>{stats.fps} fps</span>
          {!hasMicrophone && <span className="muted">no microphone</span>}
          {recognize && (
            <>
              <span>
                {stats.casts} cast{stats.casts === 1 ? '' : 's'}
                {stats.last && ` · last: ${stats.last}`}
              </span>
              <span title="How close the movement is to the nearest spell. It casts when the distance goes below the limit.">
                {stats.best
                  ? `closest: ${stats.best.spell.name} ${stats.best.distance.toFixed(2)} / ${stats.best.threshold.toFixed(2)}`
                  : 'closest: —'}
              </span>
            </>
          )}
          <button className="neon-button small" onClick={handleStop}>
            Stop camera
          </button>
        </div>
      )}
      {running && recordState.message && recordState.phase === 'idle' && (
        <div className="caster-toast">
          <span className={savedOk ? 'ok' : 'error'}>{recordState.message}</span>
        </div>
      )}
    </div>
  )
}
