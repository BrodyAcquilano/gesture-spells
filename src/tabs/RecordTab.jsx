import { useData } from '../library/DataContext.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import ComingSoon from '../components/ComingSoon.jsx'
import LiveCaster from '../components/LiveCaster.jsx'

// Recording video. In Spellbook mode the camera recognises the spellbook's
// gestures live and plays their effects. In Editing mode it records plain
// video, and the gestures are marked afterwards in the Edit tab.
export default function RecordTab({ live }) {
  const { takes } = useData()
  return (
    <Workspace
      list={
        <ListPanel
          title="Recorded videos"
          items={takes.map((take) => ({ id: take.id, name: take.name }))}
          onSelect={() => {}}
          empty="No recordings yet. Saving video comes with the recording feature."
        />
      }
      viewer={live ? <LiveCaster /> : <ComingSoon feature="Camera recording" />}
      details={
        <div className="details">
          <h2>{live ? 'Live casting' : 'Record first, edit later'}</h2>
          {live ? (
            <p className="muted">
              Start the camera and do a spell&apos;s gesture the way you recorded it. When it is recognised, the spell&apos;s
              animation appears at your hand and its audio plays. The &quot;closest&quot; reading at the top shows how near your
              movement is to a spell: it casts when the first number drops below the second. If a spell never casts, raise its
              sensitivity in the Spellbook tab or record more examples. If it casts by accident, lower it. Nothing is saved yet.
            </p>
          ) : (
            <p className="muted">
              Records camera video with its hand-tracking data, so gestures can be found and marked in the Edit tab without
              re-running the hand model.
            </p>
          )}
          <ComingSoon feature="Record, stop and save video (with microphone and effect sounds)" />
        </div>
      }
    />
  )
}
