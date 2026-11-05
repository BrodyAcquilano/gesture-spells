import { useData } from '../library/DataContext.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import ComingSoon from '../components/ComingSoon.jsx'
import PinchCaster from '../components/PinchCaster.jsx'

// Recording video. In Spellbook mode the camera runs live recognition (for now
// only the pinch test spell). In Editing mode it records plain video, and the
// gestures are marked afterwards in the Edit tab.
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
      viewer={live ? <PinchCaster /> : <ComingSoon feature="Camera recording" />}
      details={
        <div className="details">
          <h2>{live ? 'Live casting' : 'Record first, edit later'}</h2>
          <p className="muted">
            {live
              ? 'Spells from your spellbook will be recognised as you move, and their animation and sound play over the video. Right now only the pinch test spell works, and nothing is saved.'
              : 'Records camera video with its hand-tracking data, so gestures can be found and marked in the Edit tab without re-running the hand model.'}
          </p>
          <ComingSoon feature="Record, stop and save video (with microphone and effect sounds)" />
        </div>
      }
    />
  )
}
