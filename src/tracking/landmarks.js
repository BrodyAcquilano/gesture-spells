// The 21 hand landmarks MediaPipe returns, and helpers that work on them.
// A hand is stored as `points`: 21 arrays [x, y, z], where x and y are
// fractions of the frame's width and height (0 to 1) and z is a rough depth.
// This file has no browser dependencies so the Node check script can use it.
//
//   0 wrist
//   1–4  thumb (4 = tip)       5–8   index (8 = tip)
//   9–12 middle (9 = base)     13–16 ring      17–20 little finger

export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_TIP = 8
export const MIDDLE_BASE = 9
export const FINGERTIPS = [8, 12, 16, 20]

// Pairs of landmarks joined by a bone, for drawing the skeleton.
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

// MediaPipe gives objects {x, y, z}; stored gestures use rounded arrays to stay small.
export function toPoints(landmarks) {
  return landmarks.map((p) => [round(p.x), round(p.y), round(p.z)])
}

function round(value) {
  return Math.round(value * 10000) / 10000
}

// Where a spell appears: between the thumb tip and the index fingertip.
export function handPoint(points) {
  const thumb = points[THUMB_TIP]
  const index = points[INDEX_TIP]
  return [(thumb[0] + index[0]) / 2, (thumb[1] + index[1]) / 2]
}
