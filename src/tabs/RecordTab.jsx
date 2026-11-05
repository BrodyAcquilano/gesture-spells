import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import LiveCaster from '../components/LiveCaster.jsx'

// Recording video. In Spellbook mode the camera recognises the spellbook's
// gestures live and shows their effects. In Editing mode it records plain
// video with the hand movements, for marking gestures later. Either way the
// video is saved into recordings/, which stays on this computer.
export default function RecordTab({ live }) {
  const { recordings, deleteRecording } = useData()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(null)
  const selected = recordings.find((r) => r.id === selectedId)

  async function handleDelete() {
    if (!window.confirm(`Delete "${selected.name}"? The video file is removed from recordings/.`)) return
    await deleteRecording(selected.id)
    setSelectedId(null)
  }

  return (
    <Workspace
      list={
        <ListPanel
          title="Recordings"
          items={recordings.map((r) => ({ id: r.id, name: r.name, meta: `${r.duration.toFixed(0)} s` }))}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          empty="No recordings yet. Start the camera and press Record."
        />
      }
      viewer={<LiveCaster recognize={live} />}
      details={
        <div className="details">
          {selected ? (
            <>
              <div className="details-head">
                <h2>{selected.name}</h2>
                <div className="button-row">
                  <button className="neon-button small" onClick={() => navigate(`/spellbook/finalize?id=${selected.id}`)}>
                    Open in Finalize
                  </button>
                  <button className="neon-button small danger" onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </div>
              <dl className="facts">
                <dt>Recorded</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
                <dt>Length</dt>
                <dd>{selected.duration.toFixed(1)} s</dd>
                <dt>Spells cast</dt>
                <dd>{selected.casts.length}</dd>
                <dt>Saved in</dt>
                <dd>
                  recordings/{selected.id}/ <span className="muted small">(not uploaded to GitHub)</span>
                </dd>
              </dl>
            </>
          ) : (
            <>
              <h2>{live ? 'Record with live spells' : 'Record first, edit later'}</h2>
              <p className="muted">
                {live
                  ? 'Start the camera, press Record, and cast spells. Their animations show as you go; their sounds are muted while recording so the microphone does not pick them up. The video, your voice and the moments each spell was cast are saved; Finalize adds the effects and sounds and exports the finished video.'
                  : 'Records camera video and microphone together with the hand movements, so gestures can be found and marked afterwards.'}
              </p>
              <p className="muted small">Recordings are saved in the recordings/ folder of the project, which git ignores, so they stay on this computer.</p>
            </>
          )}
        </div>
      }
    />
  )
}
