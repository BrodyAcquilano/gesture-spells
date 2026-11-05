import { useState } from 'react'
import { useData } from '../library/DataContext.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import ComingSoon from '../components/ComingSoon.jsx'
import FileSelect from '../components/FileSelect.jsx'

// Editing a recorded video: select a stretch on the timeline, then apply an
// animation and/or audio file to just that stretch, or to every stretch where
// a similar gesture appears.
export default function EditTab() {
  const { takes, library } = useData()
  const [scope, setScope] = useState('selected') // 'selected' | 'similar'
  const [animationId, setAnimationId] = useState(null)
  const [audioId, setAudioId] = useState(null)

  return (
    <Workspace
      list={
        <ListPanel
          title="Recorded videos"
          items={takes.map((take) => ({ id: take.id, name: take.name }))}
          onSelect={() => {}}
          empty="Videos recorded in the Record tab will appear here."
        />
      }
      viewer={<ComingSoon feature="Video player for the open recording" />}
      timeline={
        <div className="timeline">
          <Track label="Video" />
          <Track label="Audio" />
        </div>
      }
      details={
        <div className="details">
          <h2>Apply to selection</h2>
          <div className="details-grid">
            <fieldset className="field">
              <span>Apply to</span>
              <label className="radio">
                <input type="radio" name="scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />
                Only the selected part
              </label>
              <label className="radio">
                <input type="radio" name="scope" checked={scope === 'similar'} onChange={() => setScope('similar')} />
                Every similar gesture in this video
              </label>
            </fieldset>
            <dl className="facts">
              <dt>Animation</dt>
              <dd>
                <FileSelect items={library.animations} value={animationId} onChange={setAnimationId} />
              </dd>
              <dt>Audio</dt>
              <dd>
                <FileSelect items={library.audio} value={audioId} onChange={setAudioId} />
              </dd>
            </dl>
          </div>
          <button className="neon-button" disabled title="Needs a recorded video and a selection">
            Apply (coming soon)
          </button>
        </div>
      }
    />
  )
}

function Track({ label }) {
  return (
    <div className="track">
      <span className="track-label">{label}</span>
      <div className="track-bar">
        <span className="muted small">Open a video to see its {label.toLowerCase()} track</span>
      </div>
    </div>
  )
}
