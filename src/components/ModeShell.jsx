import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

// A mode is a page with tabs along the bottom. Each tab is its own route,
// e.g. /spellbook/audio, so the browser's back button and reloads keep it.
//   tabs: [{ path: 'audio', label: 'Audio', element: <AudioTab /> }]
// Links are absolute (base + tab) because a relative link inside a /* route
// would resolve against the current tab, e.g. /spellbook/spells/audio.
export default function ModeShell({ base, tabs, defaultTab }) {
  return (
    <div className="mode">
      <main className="mode-main">
        <Routes>
          {tabs.map((tab) => (
            <Route key={tab.path} path={tab.path} element={tab.element} />
          ))}
          <Route path="*" element={<Navigate to={`${base}/${defaultTab ?? tabs[0].path}`} replace />} />
        </Routes>
      </main>
      <nav className="tab-bar" aria-label="Tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={`${base}/${tab.path}`} className="tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
