import ModeShell from '../components/ModeShell.jsx'
import LibraryTab from '../tabs/LibraryTab.jsx'
import RecordTab from '../tabs/RecordTab.jsx'
import EditTab from '../tabs/EditTab.jsx'

// After-the-fact workflow: record first, then mark gestures and add effects.
// The Animations and Audio tabs show the same library as Spellbook mode.
const TABS = [
  { path: 'animations', label: 'Animations', element: <LibraryTab kind="animations" /> },
  { path: 'audio', label: 'Audio', element: <LibraryTab kind="audio" /> },
  { path: 'record', label: 'Record', element: <RecordTab /> },
  { path: 'edit', label: 'Edit', element: <EditTab /> },
]

export default function EditingMode() {
  return <ModeShell tabs={TABS} defaultTab="record" />
}
