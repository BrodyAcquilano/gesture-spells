import ModeShell from '../components/ModeShell.jsx'
import LibraryTab from '../tabs/LibraryTab.jsx'
import SpellsTab from '../tabs/SpellsTab.jsx'
import RecordTab from '../tabs/RecordTab.jsx'
import FinalizeTab from '../tabs/FinalizeTab.jsx'

// Live workflow: build spells first, then record while they are recognised.
const TABS = [
  { path: 'animations', label: 'Animations', element: <LibraryTab kind="animations" /> },
  { path: 'audio', label: 'Audio', element: <LibraryTab kind="audio" /> },
  { path: 'spells', label: 'Spellbook', element: <SpellsTab /> },
  { path: 'record', label: 'Record', element: <RecordTab live /> },
  { path: 'finalize', label: 'Finalize', element: <FinalizeTab /> },
]

export default function SpellbookMode() {
  return <ModeShell tabs={TABS} defaultTab="spells" />
}
