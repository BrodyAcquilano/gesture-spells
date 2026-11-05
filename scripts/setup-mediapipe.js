// Puts the files MediaPipe needs at run time into public/, so the app serves
// them itself instead of fetching them from Google each time it starts:
//   public/mediapipe/  the WebAssembly runtime, copied from node_modules
//   public/models/hand_landmarker.task  the pretrained hand model, downloaded once
// Both folders are git-ignored. Runs automatically after `npm install`.
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const wasmSource = new URL('node_modules/@mediapipe/tasks-vision/wasm/', root)
const wasmTarget = new URL('public/mediapipe/', root)
const modelTarget = new URL('public/models/hand_landmarker.task', root)
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

async function exists(url) {
  try {
    return (await stat(url)).size > 0
  } catch {
    return false
  }
}

await mkdir(wasmTarget, { recursive: true })
for (const name of await readdir(wasmSource)) {
  await copyFile(new URL(name, wasmSource), new URL(name, wasmTarget))
}
console.log('Copied the MediaPipe runtime to public/mediapipe/')

if (await exists(modelTarget)) {
  console.log('Hand model already present in public/models/')
} else {
  console.log('Downloading the hand model (about 8 MB)...')
  const response = await fetch(MODEL_URL)
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  await mkdir(new URL('./', modelTarget), { recursive: true })
  await writeFile(modelTarget, Buffer.from(await response.arrayBuffer()))
  console.log(`Saved ${fileURLToPath(modelTarget)}`)
}
