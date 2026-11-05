import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import { loadTrack } from '../storage/projectApi.js'
import { detectCasts } from '../gestures/detect.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import FinalizePlayer from '../components/FinalizePlayer.jsx'
import { useConfirm } from '../components/toast.js'

// Finalize: pick a recording, see and hear it with the spells added at the
// moments they were cast, adjust which casts to keep, and export the
// finished video.
export default function FinalizeTab() {
  const { recordings, spells, findFile, updateRecording } = useData()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const selected = recordings.find((r) => r.id === params.get('id')) ?? recordings[recordings.length - 1]
  const [tracks, setTracks] = useState({}) // id -> track
  const [exported, setExported] = useState(null)
  const track = selected ? tracks[selected.id] : null

  useEffect(() => {
    if (!selected || tracks[selected.id]) return
    let cancelled = false
    loadTrack(selected.id)
      .catch(() => [])
      .then((loaded) => {
        if (!cancelled) setTracks((all) => ({ ...all, [selected.id]: loaded }))
      })
    return () => {
      cancelled = true
    }
  }, [selected, tracks])

  // A cast's spell, animation and sound, looked up by the spell's id.
  const resolveCast = useCallback(
    (cast) => {
      const spell = spells.find((s) => s.id === cast.spellId)
      return {
        spell,
        animation: spell && findFile('animations', spell.animationId),
        audio: spell && findFile('audio', spell.audioId),
      }
    },
    [spells, findFile],
  )

  const onExported = useCallback((result) => setExported(result), [])

  function select(id) {
    setParams({ id })
    setExported(null)
  }

  async function removeCast(index) {
    const cast = selected.casts[index]
    const name = resolveCast(cast).spell?.name ?? 'this spell'
    if (!(await confirm(`Remove the cast of ${name} at ${cast.t.toFixed(1)} s from this recording?`, { confirmLabel: 'Remove' }))) return
    updateRecording(selected.id, { casts: selected.casts.filter((_, i) => i !== index) })
  }

  async function detectAgain() {
    if (!track?.length) return
    if (selected.casts.length && !(await confirm('Detect spells again? The current list of casts is replaced.', { confirmLabel: 'Detect again' }))) return
    const casts = detectCasts(track, spells, (selected.width || 16) / (selected.height || 9))
    updateRecording(selected.id, { casts })
  }

  const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
  return (
    <Workspace
      list={
        <ListPanel
          title="Recordings"
          items={recordings.map((r) => ({ id: r.id, name: r.name, meta: `${r.duration.toFixed(0)} s` }))}
          selectedId={selected?.id}
          onSelect={select}
          empty="No recordings yet. Record one in the Record tab."
        />
      }
      viewer={
        selected && track ? (
          <FinalizePlayer
            key={selected.id}
            recording={selected}
            track={track}
            casts={selected.casts}
            resolveCast={resolveCast}
            onExported={onExported}
          />
        ) : (
          <p className="muted centered">{selected ? 'Loading…' : 'Record a video in the Record tab first.'}</p>
        )
      }
      details={
        selected && (
          <div className="details">
            <div className="details-head">
              <input
                className="title-input"
                value={selected.name}
                onChange={(event) => updateRecording(selected.id, { name: event.target.value })}
                aria-label="Recording name"
              />
            </div>
            {exported && (
              <p className={exported.error ? 'error' : 'ok'}>
                {exported.error ? (
                  `Export failed: ${exported.error}`
                ) : (
                  <>
                    Exported to {exported.path}.{' '}
                    <a className="download-link" href={exported.url} download={exported.name}>
                      Download {exported.ext.toUpperCase()}
                    </a>
                  </>
                )}
              </p>
            )}
            <div className="details-grid">
              <dl className="facts">
                <dt>Recorded</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
                <dt>Length</dt>
                <dd>{selected.duration.toFixed(1)} s</dd>
                <dt>Format</dt>
                <dd>
                  {selected.ext?.toUpperCase()} · {selected.width}×{selected.height}
                </dd>
                <dt>Spells</dt>
                <dd>
                  <button className="neon-button small" onClick={detectAgain} disabled={!track?.length} title="Look for spells in the recorded hand movements again, with the spellbook as it is now">
                    Detect spells again
                  </button>
                </dd>
              </dl>
              <div className="field">
                <span>Spells cast ({selected.casts.length})</span>
                {selected.casts.length === 0 ? (
                  <p className="muted">None. Try &quot;Detect spells again&quot;.</p>
                ) : (
                  <ul className="cast-list">
                    {selected.casts.map((cast, i) => {
                      const { spell, animation, audio } = resolveCast(cast)
                      return (
                        <li key={`${cast.t}-${i}`}>
                          <span className="cast-time">{clock(cast.t)}</span>
                          <span>{spell?.name ?? '(deleted spell)'}</span>
                          <span className="muted small">
                            {[animation?.name, audio?.name].filter(Boolean).join(' + ') || 'no animation or sound'}
                          </span>
                          <button className="neon-button small danger" onClick={() => removeCast(i)} title="Remove this cast">
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )
      }
    />
  )
}
