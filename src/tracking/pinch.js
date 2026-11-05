// Pinch detection: thumb tip touching index fingertip.
//
// The raw thumb-to-index distance changes with how far the hand is from the
// camera, so it is divided by the palm length (wrist to the base of the middle
// finger), which shrinks and grows by the same factor. The ratio is about 0.1
// when the tips touch and above 0.6 with the hand open.
//
// Two thresholds (hysteresis) stop the pinch flickering on and off when the
// ratio hovers near a single cut-off: it must drop below CLOSE to start a
// pinch and rise above OPEN to end it.
import { INDEX_TIP, MIDDLE_BASE, THUMB_TIP, WRIST } from './handTracker.js'

const CLOSE = 0.3
const OPEN = 0.45

// x and y are fractions of the frame, so they are scaled back to pixels first;
// otherwise a wide frame would make horizontal distances look shorter.
function distance(a, b, width, height) {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)
}

export function pinchRatio(landmarks, width, height) {
  const palm = distance(landmarks[WRIST], landmarks[MIDDLE_BASE], width, height)
  if (palm === 0) return Infinity
  return distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP], width, height) / palm
}

// The point between thumb tip and index tip, as fractions of the frame.
export function pinchPoint(landmarks) {
  const thumb = landmarks[THUMB_TIP]
  const index = landmarks[INDEX_TIP]
  return { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 }
}

// Keeps the pinch state for one hand between frames.
export function createPinchDetector() {
  let pinching = false
  return {
    update(landmarks, width, height) {
      const ratio = pinchRatio(landmarks, width, height)
      const was = pinching
      if (!pinching && ratio < CLOSE) pinching = true
      else if (pinching && ratio > OPEN) pinching = false
      return { pinching, started: pinching && !was, ended: !pinching && was, ratio }
    },
    reset() {
      pinching = false
    },
  }
}
