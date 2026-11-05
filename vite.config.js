import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The port is pinned because the browser keeps IndexedDB per origin:
// localhost:5173 and localhost:5174 would see two different libraries.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
