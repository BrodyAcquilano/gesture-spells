import { NavLink } from 'react-router-dom'

const MODES = [
  { path: '/spellbook', label: 'Spellbook' },
  { path: '/editing', label: 'Editing' },
  { path: '/animation-builder', label: 'Animation Builder' },
  { path: '/audio-lab', label: 'Audio Lab' },
]

export default function Header() {
  return (
    <header className="header">
      <h1 className="title">
        Gesture <span>Spellbook</span>
      </h1>
      <nav className="mode-links" aria-label="Modes">
        {MODES.map((mode) => (
          <NavLink key={mode.path} to={mode.path} className="mode-link">
            {mode.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
