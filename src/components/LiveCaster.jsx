import { useMemo, useRef, useState } from 'react'
import { useData } from '../library/DataContext.js'
import { useHandCamera } from '../tracking/useHandCamera.js'
import { drawHand, mirroredMapper } from '../tracking/drawHand.js'
import { handPoint } from '../tracking/landmarks.js'
import { buildRecognizer } from '../gestures/recognizer.js'
import { createEffectPlayer } from '../effects/effectPlayer.js'

const HISTORY_MS = 4000
const COOLDOWN_MS = 1000

// Live camera that recognises the spellbook's recorded gestures and plays each
// spell's animation (at the hand) and audio when it is cast.
export default function LiveCaster() {
  const { spells, findFile } = useData()
  const recognizer = useMemo(() => buildRecognizer(spells), [spells])
  const live = useRef(null) // per-run state the loop changes every frame
  const [stats, setStats] = useState({ fps: 0, hands: 0, casts: 0, best: null, last: '' })

  const { videoRef, canvasRef, status, error, start, stop } = useHandCamera(({ ctx, w, h, hands, now, dt, fresh }) => {
    live.current ??= { history: [], player: createEffectPlayer(), cooldown: 0, tick: 0, frames: 0, statsAt: now, casts: 0, best: null, last: '' }
    const s = live.current
    const hand = hands[0]
    const map = mirroredMapper(w, h)

    if (fresh) {
      s.frames++
      if (hand) {
        s.history.push({ t: now, label: hand.label, points: hand.points })
      } else if (s.history.length && now - s.history[s.history.length - 1].t > 300) {
        s.history = [] // the hand left; start afresh when it returns
      }
      while (s.history.length && s.history[0].t < now - HISTORY_MS) s.history.shift()

      // Matching every other camera frame is plenty and halves the work.
      if (hand && now >= s.cooldown && ++s.tick % 2 === 0) {
        const { best, match } = recognizer.classify(s.history, now, w / h)
        s.best = best
        if (match) {
          const { spell } = match
          const [x, y] = map(handPoint(hand.points))
          s.player.cast({
            animation: findFile('animations', spell.animationId),
            audio: findFile('audio', spell.audioId),
            x,
            y,
            label: spell.name,
          })
          s.casts++
          s.last = spell.name
          s.cooldown = now + COOLDOWN_MS
          s.history = []
        }
      }
    }

    for (const each of hands) drawHand(ctx, each.points, map)
    s.player.update(dt)
    s.player.draw(ctx)

    if (now - s.statsAt > 400) {
      setStats({ fps: Math.round((s.frames * 1000) / (now - s.statsAt)), hands: hands.length, casts: s.casts, best: s.best, last: s.last })
      s.frames = 0
      s.statsAt = now
    }
  })

  function handleStop() {
    live.current?.player.clear()
    live.current = null
    stop()
  }

  const castable = recognizer.entries
  const running = status === 'running'
  return (
    <div className="caster">
      <video ref={videoRef} className="caster-video" playsInline muted />
      <canvas ref={canvasRef} className="caster-canvas" />
      {!running && (
        <div className="caster-overlay">
          <p className="caster-title">Live casting</p>
          {castable.length === 0 ? (
            <p className="muted">
              No spell has a recorded gesture yet. Go to the Spellbook tab, make a spell, and record its gesture first.
            </p>
          ) : (
            <p className="muted">Ready to recognise: {castable.map((entry) => entry.spell.name).join(', ')}</p>
          )}
          {error && <p className="error">{error}</p>}
          <button className="neon-button" onClick={start} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading camera and hand model…' : 'Start camera'}
          </button>
        </div>
      )}
      {running && (
        <div className="caster-hud">
          <span>{stats.fps} fps</span>
          <span>
            {stats.hands} hand{stats.hands === 1 ? '' : 's'}
          </span>
          <span>
            {stats.casts} cast{stats.casts === 1 ? '' : 's'}
            {stats.last && ` · last: ${stats.last}`}
          </span>
          <span title="How close the movement is to the nearest spell. It casts when the distance goes below the limit.">
            {stats.best
              ? `closest: ${stats.best.spell.name} ${stats.best.distance.toFixed(2)} / ${stats.best.threshold.toFixed(2)}`
              : 'closest: —'}
          </span>
          <button className="neon-button small" onClick={handleStop}>
            Stop
          </button>
        </div>
      )}
    </div>
  )
}
