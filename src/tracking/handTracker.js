// Wraps MediaPipe's pretrained Hand Landmarker. Given a video frame it returns
// 21 landmarks for each hand it sees (see landmarks.js).
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const BASE = import.meta.env.BASE_URL

// Loading the model takes a second or two, so it is done once and shared.
let trackerPromise = null

export function loadHandTracker() {
  if (!trackerPromise) {
    trackerPromise = (async () => {
      // Both paths point at files `npm run setup` placed in public/.
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe`)
      return HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: `${BASE}models/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })
    })()
    trackerPromise.catch(() => {
      trackerPromise = null
    })
  }
  return trackerPromise
}
