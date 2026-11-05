// Cuts a recording down to the part where the hand actually moved.
//
// The recorder captures a fixed 2.5 s, but the gesture itself may take only
// half a second of that. The still time before and after would make the saved
// example longer than the real gesture, and live matching would then wait for
// that stillness too.
//
// Frame-to-frame change is no good for finding the movement: the tracker's
// jitter is about as large as the change between two frames of a quick pinch.
// Instead each frame is compared with the starting pose (the average of the
// first few frames) and with the final pose. The gesture starts where the hand
// gets clearly away from the starting pose, and ends where it is last clearly
// away from the final pose.
import { distance, sequenceFeatures } from './features.js'

export const MIN_FRAMES = 10
export const MOVE_PEAK_MIN = 1.0 // tracker jitter alone reaches about 0.5, a pinch about 2.5
const MOVE_FRACTION = 0.25 // of the largest distance, to count as "moved"
const POSE_FRAMES = 5
const PAD_FRAMES = 5

function averageOf(vectors) {
  return vectors[0].map((_, d) => vectors.reduce((sum, vector) => sum + vector[d], 0) / vectors.length)
}

export function trimRecording(frames, aspect, missedFrames) {
  const total = frames.length + missedFrames
  if (frames.length < MIN_FRAMES || frames.length < total * 0.6) {
    return { error: "Your hand wasn't in view for most of the recording. Keep your whole hand inside the frame and try again." }
  }

  const vectors = sequenceFeatures(frames, aspect)
  const startPose = averageOf(vectors.slice(0, POSE_FRAMES))
  const endPose = averageOf(vectors.slice(-POSE_FRAMES))
  const fromStart = vectors.map((vector) => distance(vector, startPose))
  const fromEnd = vectors.map((vector) => distance(vector, endPose))
  const peakStart = Math.max(...fromStart)
  const peakEnd = Math.max(...fromEnd)
  if (Math.max(peakStart, peakEnd) < MOVE_PEAK_MIN) {
    return { error: 'No movement was seen. Start still, do the gesture once after GO, then hold still.' }
  }

  let first = fromStart.findIndex((value) => value > peakStart * MOVE_FRACTION)
  let last = fromEnd.findLastIndex((value) => value > peakEnd * MOVE_FRACTION)
  if (first === -1 || last === -1 || last < first) {
    first = 0
    last = frames.length - 1
  }
  first = Math.max(0, first - PAD_FRAMES)
  last = Math.min(frames.length - 1, last + PAD_FRAMES)
  const kept = frames.slice(first, last + 1)
  if (kept.length < 5) return { error: 'The movement was too short to use. Try again a little slower.' }

  const start = kept[0].t
  return {
    example: {
      recordedAt: Date.now(),
      aspect,
      duration: kept[kept.length - 1].t - start,
      frames: kept.map((frame) => ({ ...frame, t: Math.round(frame.t - start) })),
    },
  }
}
