import { Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header.jsx'
import DataProvider from './library/DataProvider.jsx'
import ToastProvider from './components/ToastProvider.jsx'
import SpellbookMode from './modes/SpellbookMode.jsx'
import EditingMode from './modes/EditingMode.jsx'
import PlaceholderMode from './modes/PlaceholderMode.jsx'

export default function App() {
  return (
    <ToastProvider>
    <DataProvider>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/spellbook/*" element={<SpellbookMode />} />
          <Route path="/editing/*" element={<EditingMode />} />
          <Route
            path="/animation-builder"
            element={
              <PlaceholderMode title="Animation Builder">
                Design animations from particles, trails and shapes, and save them to the shared library.
              </PlaceholderMode>
            }
          />
          <Route
            path="/audio-lab"
            element={
              <PlaceholderMode title="Audio Lab">
                Generate sounds by layering waves, noise and envelopes, and save them to the shared library.
              </PlaceholderMode>
            }
          />
          <Route path="*" element={<Navigate to="/spellbook" replace />} />
        </Routes>
      </div>
    </DataProvider>
    </ToastProvider>
  )
}
