import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { projectStorage } from './server/storage.js'

// The port is pinned because the browser keeps its saved data per origin:
// localhost:5173 and localhost:5174 would see two different libraries.
export default defineConfig({
  plugins: [react(), projectStorage()],
  server: {
    port: 5173,
    strictPort: true,
    // Saving a spell, recording or export must not make the page reload.
    watch: { ignored: ['**/public/library/**', '**/recordings/**', '**/exports/**'] },
  },
  preview: { port: 4173, strictPort: true },
})
