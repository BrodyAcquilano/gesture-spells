import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../library/DataContext.js'
import { useHandCamera } from '../tracking/useHandCamera.js'
import { drawHand, mirroredMapper } from '../tracking/drawHand.js'
import { buildRecognizer, createLiveMatcher } from '../gestures/recognizer.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'
import { preloadSound } from '../effects/audioEngine.js'
import { startRecording, timestampId } from '../record/videoRecorder.js'


// Live camera with recording.
//
//   recognize  true (Spellbook mode): recognises spells and shows their
//              effects as they are cast. false (Editing mode): camera only.
//   spellIds   which spells to recognise (null: all of them)
//   details    { name, description } for the next recording
//   onPhase    called with 'idle' | 'recording' | 'saving' as that changes
//   onSaved    called with the new recording's details once it is saved
//
// A recording saves, into recordings/ (local only):
//   the camera video with the microphone, as it came from the camera, with
//     no effects drawn on it (Finalize adds them)
//   the hand positions in every frame (track)
//   each spell cast: when, which spell, and where the hand was
// While recording, effects still show but their sounds are muted, so the
// microphone doesn't pick them up and Finalize doesn't add them twice.
export default function LiveCaster({ recognize = true, spellIds = null, details, onPhase, onSaved }) {
  const { spells, findFile, saveRecording } = useData()
  // The ticked spells, as a string, so the recogniser is only rebuilt when
  // the choice really changes (not every time the page redraws).
  const idsKey = spellIds ? [...spellIds].sort().join('|') : null
  const active = useMemo(() => {
    if (!recognize) return []
    const ids = idsKey == null ? null : idsKey.split('|')
    return spells.filter((spell) => !ids || ids.includes(spell.id))
  }, [spells, idsKey, recognize])
  const recognizer = useMemo(() => buildRecognizer(active), [active])
  // Decode every spell's sound now, so casting plays it without delay.
  useEffect(() => {
    for (const spell of active) preloadSound(findFile('audio', spell.audioId)?.url)
  }, [active, findFile])
  const latest = useRef({ details, onPhase, onSaved, spellIds })
  useEffect(() => {
    latest.current = { details, onPhase, onSaved, spellIds }
  })
  const live = useRef(null) // per-run state the loop changes every frame
  const recording = useRef(null) // { handle, track, casts, size } while recording
  const [stats, setStats] = useState({ fps: 0, hands: 0, casts: 0, best: null, last: '' })
  const [recordState, setRecordState] = useState({ phase: 'idle', seconds: 0, message: '', ok: true })

  function setPhase(phase, extra = {}) {
    setRecordState((r) => ({ ...r, ...extra, phase }))
    latest.current.onPhase?.(phase)
  }

  const { videoRef, canvasRef, status, error, hasMicrophone, start, stop, getStream } = useHandCamera(
    ({ ctx, w, h, hands, now, dt, fresh }) => {
      live.current ??= { player: createEffectPlayer(), frames: 0, statsAt: now, casts: 0, best: null, last: '' }
      if (live.current.recognizer !== recognizer) {
        // The spells changed: a new matcher, but effects already playing carry on.
        live.current.recognizer = recognizer
        live.current.matcher = createLiveMatcher(recognizer)
      }
      const s = live.current
      const rec = recording.current
      const hand = hands[0]
      const map = mirroredMapper(w, h)

      if (fresh) {
        s.frames++
        if (hand && rec) rec.track.push({ t: (now - rec.handle.startedAt) / 1000, label: hand.label, points: hand.points })
        if (rec) rec.size = { width: w, height: h }

        // The matcher watches the hand and, when it settles after moving,
        // compares that movement with the spells' examples.
        const result = hand && recognizer.entries.length ? s.matcher.push({ t: now, label: hand.label, points: hand.points }, w / h) : null
        if (result) {
          s.best = result.best
          const { match } = result
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
    try {
      recording.current = { handle: startRecording(stream), track: [], casts: [], size: null }
      setPhase('recording', { seconds: 0, message: '' })
    } catch (err) {
      recording.current = null
      setPhase('idle', { message: err.message, ok: false })
    }
  }

  async function endRecording() {
    const rec = recording.current
    if (!rec) return
    recording.current = null
    setPhase('saving')
    try {
      const { blob, mimeType, ext, duration } = await rec.handle.stop()
      const createdAt = Date.now()
      const { details: next = {}, spellIds: chosen } = latest.current
      const meta = {
        id: timestampId('rec'),
        name: next.name?.trim() || `Recording ${new Date(createdAt).toLocaleString()}`,
        description: next.description ?? '',
        createdAt,
        duration,
        mimeType,
        ext,
        width: rec.size?.width ?? 0,
        height: rec.size?.height ?? 0,
        recognized: recognize,
        spellIds: recognize ? (chosen ?? spells.map((s) => s.id)) : [],
        casts: rec.casts,
      }
      await saveRecording({ blob, ext, meta, track: rec.track })
      setPhase('idle', { message: `Saved "${meta.name}" (${duration.toFixed(1)} s, ${ext.toUpperCase()}, ${meta.casts.length} spell${meta.casts.length === 1 ? '' : 's'} cast).`, ok: true })
      latest.current.onSaved?.(meta)
    } catch (err) {
      setPhase('idle', { message: `Could not save the recording: ${err.message}`, ok: false })
    }
  }

  function handleStopCamera() {
    if (recording.current) endRecording()
    live.current?.player.clear()
    live.current = null
    stop()
  }

  const running = status === 'running'
  const recordingNow = recordState.phase === 'recording'
  const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  return (
    <div className="caster">
      <video ref={videoRef} className="caster-video" playsInline muted />
      <canvas ref={canvasRef} className="caster-canvas" />
      {!running && (
        <div className="caster-overlay">
          <p className="caster-title">New recording</p>
          {recognize &&
            (recognizer.entries.length === 0 ? (
              <p className="muted">No spells are ticked (or none has a recorded gesture), so none will be recognised.</p>
            ) : (
              <p className="muted">Will recognise: {recognizer.entries.map((entry) => entry.spell.name).join(', ')}</p>
            ))}
          {error && <p className="error">{error}</p>}
          {recordState.message && <p className={recordState.ok ? 'ok' : 'error'}>{recordState.message}</p>}
          <button className="neon-button" onClick={start} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading camera and hand model…' : 'Start camera'}
          </button>
        </div>
      )}
      {running && (
        <div className="caster-hud">
          <span>{stats.fps} fps</span>
          {!hasMicrophone && <span className="muted">no microphone</span>}
          {recognize && (
            <>
              <span>
                {stats.casts} cast{stats.casts === 1 ? '' : 's'}
                {stats.last && ` · last: ${stats.last}`}
              </span>
              <span title="After each movement: the nearest spell, how close the movement was, and that spell's limit (it casts when the first number is below the second), then the next nearest spell. A spell within its limit doesn't cast if the next one is nearly as close (under 0.7 × as far is needed).">
                {stats.best
                  ? `last move: ${stats.best.spell.name} ${stats.best.distance.toFixed(2)} / ${stats.best.threshold.toFixed(2)}${
                      stats.best.rival ? ` · next ${stats.best.rival.spell.name} ${stats.best.rival.distance.toFixed(2)}` : ''
                    }${stats.best.tooClose && stats.best.distance < stats.best.threshold ? ' · too close to call' : ''}`
                  : 'last move: —'}
              </span>
            </>
          )}
        </div>
      )}
      {running && (
        <div className="record-bar">
          {recordingNow ? (
            <>
              <span className="rec-dot">● REC {clock(recordState.seconds)}</span>
              <button className="neon-button danger record-button" onClick={endRecording}>
                ■ Stop recording
              </button>
            </>
          ) : (
            <button className="neon-button record-button" onClick={beginRecording} disabled={recordState.phase === 'saving'}>
              {recordState.phase === 'saving' ? 'Saving…' : '● Start recording'}
            </button>
          )}
          {recordState.message && recordState.phase === 'idle' && (
            <span className={recordState.ok ? 'ok small' : 'error small'}>{recordState.message}</span>
          )}
          <button className="neon-button small" onClick={handleStopCamera}>
            Stop camera
          </button>
        </div>
      )}
    </div>
  )
}
