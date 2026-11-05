import { useData } from '../library/DataContext.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import ComingSoon from '../components/ComingSoon.jsx'

// Reviewing a live recording before exporting it: trim, fix effects that fired
// at the wrong moment or not at all, then save the finished video.
export default function FinalizeTab() {
  const { takes } = useData()
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
      viewer={<ComingSoon feature="Playback with the effects that fired during recording" />}
      details={
        <div className="details">
          <h2>Finalize</h2>
          <ComingSoon feature="Trim, fix missed or wrong spells, export to a video file" />
        </div>
      }
    />
  )
}
