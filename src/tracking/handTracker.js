// Wraps MediaPipe's pretrained Hand Landmarker. Given a video frame it returns,
// for each hand it sees, 21 landmarks with x and y between 0 and 1 (fractions
// of the frame's width and height) and a rough depth z.
//
// Landmark numbers used in this app:
//   0 wrist, 4 thumb tip, 8 index fingertip, 9 base of the middle finger
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_TIP = 8
export const MIDDLE_BASE = 9
export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS

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
