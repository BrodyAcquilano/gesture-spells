import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import { useConfirm, useToast } from '../components/toast.js'
import { useTrack } from '../record/useTrack.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import LiveCaster from '../components/LiveCaster.jsx'
import FinalizePlayer from '../components/FinalizePlayer.jsx'
import SpellChecklist from '../components/SpellChecklist.jsx'

const NEW = 'new'

// Recording video.
//
// Left column, split in half:
//   top     the recordings. The green + (or "New recording") connects to the
//           camera for a new one; a saved recording plays back instead.
//   bottom  for a new recording, which spells to recognise, as tick boxes.
//           Untick a spell so it can't fire by mistake (a pinch that looks
//           like a snap). The choice is saved with the recording. A saved
//           recording's spells can't be changed here, so this half is empty.
// Details: the name and description (for the next recording, or editable for
// a saved one), and Delete.
//
// In Editing mode spells aren't recognised while recording (live = false).
// Recordings are saved into recordings/, which stays on this computer.
export default function RecordTab({ live }) {
  const { recordings, spells, deleteRecording, updateRecording, findFile } = useData()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const showMessage = useToast()
  const [selectedId, setSelectedId] = useState(NEW)
  const [phase, setPhase] = useState('idle') // of the camera's recording
  const [next, setNext] = useState({ name: '', description: '' }) // details for the next recording
  const [spellIds, setSpellIds] = useState(null) // null: every spell with a gesture
  const selected = selectedId === NEW ? null : recordings.find((r) => r.id === selectedId)
  const isNew = !selected
  const track = useTrack(selected?.id)
  const chosen = useMemo(() => spellIds ?? spells.filter((s) => s.gesture?.examples?.length).map((s) => s.id), [spellIds, spells])

  const resolveCast = useCallback(
    (cast) => {
      const spell = spells.find((s) => s.id === cast.spellId)
      return { spell, animation: spell && findFile('animations', spell.animationId), audio: spell && findFile('audio', spell.audioId) }
    },
    [spells, findFile],
  )
  const ignoreExport = useCallback(() => {}, [])

  function select(id) {
    if (phase !== 'idle' && id !== NEW) {
      showMessage('Stop recording first: switching recordings would turn the camera off.')
      return
    }
    setSelectedId(id)
  }

  const onSaved = useCallback(() => setNext({ name: '', description: '' }), [])

  async function handleDelete() {
    if (!(await confirm(`Delete "${selected.name}"? Its video is removed from recordings/.`))) return
    await deleteRecording(selected.id)
    setSelectedId(NEW)
  }

  const items = [
    { id: NEW, name: '● New recording', meta: phase === 'recording' ? 'REC' : '' },
    ...recordings.map((r) => ({ id: r.id, name: r.name, meta: `${r.duration.toFixed(0)} s` })),
  ]

  let viewer
  if (isNew) {
    viewer = (
      <LiveCaster recognize={live} spellIds={live ? chosen : null} details={next} onPhase={setPhase} onSaved={onSaved} />
    )
  } else if (track) {
    viewer = (
      <FinalizePlayer
        key={selected.id}
        recording={selected}
        track={track}
        casts={selected.casts}
        resolveCast={resolveCast}
        onExported={ignoreExport}
        showExport={false}
      />
    )
  } else {
    viewer = <p className="muted centered">Loading…</p>
  }

  return (
    <Workspace
      list={
        <div className="list-split">
          <ListPanel
            title="Recordings"
            items={items}
            selectedId={selectedId}
            onSelect={select}
            onAdd={() => select(NEW)}
            addLabel="New recording"
            empty=""
          />
          {isNew && live ? (
            <SpellChecklist spells={spells} selected={chosen} onChange={setSpellIds} />
          ) : (
            <div className="list-placeholder muted small">
              {isNew
                ? 'Editing mode records without recognising spells.'
                : 'The spells for a recording are chosen before it is made. Finalize can detect spells again.'}
            </div>
          )}
        </div>
      }
      viewer={viewer}
      details={
        <div className="details">
          {isNew ? (
            <>
              <div className="details-head">
                <input
                  className="title-input"
                  value={next.name}
                  placeholder="Name for the new recording"
                  onChange={(event) => setNext((n) => ({ ...n, name: event.target.value }))}
                  aria-label="Recording name"
                />
              </div>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={next.description}
                  onChange={(event) => setNext((n) => ({ ...n, description: event.target.value }))}
                  placeholder="What happens in this recording…"
                />
              </label>
              <p className="muted small">
                {live
                  ? 'Start the camera, tick the spells to recognise, then Start recording. Animations show as you cast; their sounds are muted while recording so the microphone does not pick them up. Finalize adds them back and exports the finished video.'
                  : 'Records camera video and microphone with the hand movements, so gestures can be found afterwards.'}{' '}
                Recordings are saved in recordings/, which git ignores, so they stay on this computer.
              </p>
            </>
          ) : (
            <>
              <div className="details-head">
                <input
                  className="title-input"
                  value={selected.name}
                  onChange={(event) => updateRecording(selected.id, { name: event.target.value })}
                  aria-label="Recording name"
                />
                <button className="neon-button small" onClick={() => navigate(`/spellbook/finalize?id=${selected.id}`)}>
                  Open in Finalize
                </button>
              </div>
              <div className="details-grid">
                <dl className="facts">
                  <dt>Recorded</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                  <dt>Length</dt>
                  <dd>{selected.duration.toFixed(1)} s</dd>
                  <dt>Spells</dt>
                  <dd>
                    {selected.casts.length} cast
                    {selected.spellIds?.length ? ` · recognising ${selected.spellIds.map((id) => spells.find((s) => s.id === id)?.name ?? '?').join(', ')}` : ''}
                  </dd>
                  <dt>Saved in</dt>
                  <dd>recordings/{selected.id}/</dd>
                </dl>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={selected.description ?? ''}
                    onChange={(event) => updateRecording(selected.id, { description: event.target.value })}
                    placeholder="What happens in this recording…"
                  />
                </label>
              </div>
              <div className="delete-row">
                <button className="neon-button small danger" onClick={handleDelete}>
                  Delete recording
                </button>
              </div>
            </>
          )}
        </div>
      }
    />
  )
}
