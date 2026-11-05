// Recognises spells from live hand movement by comparing it with each spell's
// recorded examples. Nothing is trained: adding an example is enough.
//
// How a live gesture is found and matched:
//   1. Watch how much the hand moves from frame to frame. When it has been
//      clearly moving and then settles, a gesture has just been completed.
//      That is the moment to cast, and where the animation should appear.
//   2. Take the last few seconds of movement up to that moment and compare it
//      with each recorded example. The example may line up with any later
//      part of those seconds (the live stretch also holds whatever the hand
//      did before), but both must end together. This is "subsequence"
//      dynamic time warping: like DTW, but the start of the live movement is
//      free.
//   3. The spell of the closest example wins, if it is within that spell's
//      limit.
//
// A spell's limit comes from its own examples: how close each one is to its
// nearest fellow example. A spell done in two styles (a small and a large
// pinch) still gets a tight, honest limit, because each example is near the
// others of its own style.
//
// Recorded examples are compared the same way: an example runs from when the
// hand started moving to when it settled (see trim.js), so its end lines up
// with the moment a live gesture is found.
import { arrivalTime, distance, sequenceFeatures } from './features.js'

// Every number the recogniser uses. Tuned with `npm run tune`
// (scripts/tune-recognizer.js) on the generated examples, and checked
// against the owner's real recordings of snaps and fireballs (which are not
// stored as examples): they should cast, and nothing should cast the wrong
// spell. The limits are generous (limitSlack 4) because generated examples
// are more alike than real gestures; the ratio test keeps a movement that is
// halfway between two spells from casting either.
export const DEFAULT_SETTINGS = {
  stepMs: 60, // movements are resampled to one step per this many ms
  liveSeconds: 3, // how much live movement is compared, up to the moment it settles
  endWeight: 1, // how much the final pose counts on top of DTW
  limitQuantile: 0.9, // a spell's limit: this share of its examples' nearest-fellow distances…
  limitSlack: 4, // …times this…
  minThreshold: 0.2, // …but at least this
  maxThreshold: 5, // …and at most this
  margin: null, // and below this × the distance to the nearest other spell (null: no such cap)
  minSpan: 0.4, // a live match must last at least this share of the example (0.4: a gesture up to 2.5× faster still matches)
  ratio: 0.7, // the nearest spell must also be this many times closer than the next nearest (null: no test)
  moveThreshold: 0.04, // hand movement (palm lengths per 1/30 s, five fastest points, over 100 ms) that counts as moving
  settleThreshold: 0.045, // …and as settled
  features: { shapeWeight: 0.25, tipWeight: 2, pathWeight: 0, facingWeight: 0, depthWeight: 8, curlWeight: 1 },
}

const SPAN_MS = 100 // movement is measured over this long
const AFTER_ARRIVAL_MS = 50 // keep a frame or so past the arrival moment
const MIN_STEPS = 3
export const DEFAULT_THRESHOLD = 1 // used when a spell has only one example

// Resamples vectors taken at uneven times to one per stepMs, ending exactly
// at the last time (so movements are aligned at their ends).
function resampleByTime(times, vectors, stepMs) {
  const end = times[times.length - 1]
  const count = Math.max(MIN_STEPS, Math.floor((end - times[0]) / stepMs) + 1)
  const out = []
  let j = 0
  for (let s = count - 1; s >= 0; s--) {
    const t = end - s * stepMs
    while (j < times.length - 2 && times[j + 1] < t) j++
    const span = times[j + 1] - times[j]
    const f = span > 0 ? Math.min(1, Math.max(0, (t - times[j]) / span)) : 0
    const a = vectors[j]
    const b = vectors[Math.min(j + 1, vectors.length - 1)]
    out.push(a.map((value, d) => value + (b[d] - value) * f))
  }
  return out
}

// Feature vectors for a stretch of frames, one per stepMs, ending at its
// last frame. The path is measured from where the hand ends up.
function vectorsOf(frames, aspect, settings) {
  const vectors = sequenceFeatures(frames, aspect, settings.features, 'end')
  return resampleByTime(
    frames.map((frame) => frame.t),
    vectors,
    settings.stepMs,
  )
}

// Subsequence DTW: the whole `example` against any ending part of `live`,
// both ending together. Returns the average distance per example step, plus
// the end term.
function matchScore(example, live, endWeight, minSpan = 0) {
  const m = example.length
  const n = live.length
  // previous[c]: best total cost of matching example[0..i] ending at live[c],
  // and previousStart[c]: where in live that best match started.
  let previous = new Float64Array(n)
  let previousStart = new Int32Array(n)
  for (let c = 0; c < n; c++) {
    previous[c] = distance(example[0], live[c]) // the example may start anywhere
    previousStart[c] = c
  }
  for (let i = 1; i < m; i++) {
    const current = new Float64Array(n).fill(Infinity)
    const currentStart = new Int32Array(n)
    for (let c = 0; c < n; c++) {
      const d = distance(example[i], live[c])
      let best = previous[c] // live waits
      let start = previousStart[c]
      if (c > 0) {
        if (previous[c - 1] < best) [best, start] = [previous[c - 1], previousStart[c - 1]] // both move on
        if (current[c - 1] < best) [best, start] = [current[c - 1], currentStart[c - 1]] // example waits
      }
      current[c] = d + best
      currentStart[c] = start
    }
    previous = current
    previousStart = currentStart
  }
  // The live movement must last at least minSpan of the example: otherwise
  // the whole example has been squashed onto a moment or two of live
  // movement, which would let a hand lowering a finger match one raising it.
  if (n - 1 - previousStart[n - 1] < minSpan * (m - 1)) return Infinity
  return previous[n - 1] / m + endWeight * distance(example[m - 1], live[n - 1])
}

// The part of a recorded example up to when the hand arrives at its final pose.
function examplePart(example) {
  const end = Math.min(example.duration, arrivalTime(example.frames, example.aspect) + AFTER_ARRIVAL_MS)
  return example.frames.filter((frame) => frame.t <= end)
}

// spells: those with gesture examples. sensitivity > 1 makes a spell easier
// to trigger, < 1 stricter. overrides: any of DEFAULT_SETTINGS to change.
export function buildRecognizer(spells, overrides = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides, features: { ...DEFAULT_SETTINGS.features, ...overrides.features } }
  const withGestures = spells.filter((spell) => spell.gesture?.examples?.length)
  const prepared = withGestures.map((spell) => spell.gesture.examples.map((example) => vectorsOf(examplePart(example), example.aspect, settings)))

  const entries = withGestures.map((spell, s) => {
    const examples = prepared[s]
    let own = DEFAULT_THRESHOLD
    if (examples.length >= 2) {
      const nearestFellow = examples.map((a) => Math.min(...examples.filter((b) => b !== a).map((b) => matchScore(b, a, settings.endWeight, settings.minSpan))))
      const sorted = [...nearestFellow].sort((a, b) => a - b)
      const at = sorted[Math.min(sorted.length - 1, Math.floor(settings.limitQuantile * sorted.length))]
      own = Math.min(settings.maxThreshold, Math.max(settings.minThreshold, at * settings.limitSlack))
    }
    let nearestOther = Infinity
    if (settings.margin != null) {
      const others = prepared.filter((_, o) => o !== s).flat()
      for (const a of examples) for (const b of others) nearestOther = Math.min(nearestOther, matchScore(a, b, settings.endWeight, settings.minSpan))
    }
    const base = settings.margin == null ? own : Math.min(own, settings.margin * nearestOther)
    return { spell, examples, threshold: base * (spell.sensitivity ?? 1) }
  })

  // Compares a stretch of live frames (ending when the hand settled) with
  // every example. Returns { best: { spell, distance, threshold } | null,
  // match: same | null }.
  function classifySegment(frames, aspect) {
    if (frames.length < 2 || !entries.length) return { best: null, match: null }
    const views = bothHands(frames, aspect)
    // Two distances per spell: `strict` needs the live movement to last at
    // least minSpan of the example (an honest match); `loose` doesn't, so it
    // shows anything the movement even vaguely resembles.
    const scored = entries.map((entry) => {
      let strict = Infinity
      let loose = Infinity
      for (const live of views) {
        for (const example of entry.examples) {
          strict = Math.min(strict, matchScore(example, live, settings.endWeight, settings.minSpan))
          loose = Math.min(loose, matchScore(example, live, settings.endWeight, 0))
        }
      }
      return { entry, strict, loose }
    })
    let winner = scored[0]
    for (const s of scored) if (s.strict < winner.strict || (!Number.isFinite(winner.strict) && s.loose < winner.loose)) winner = s
    const best = { spell: winner.entry.spell, distance: Number.isFinite(winner.strict) ? winner.strict : winner.loose, threshold: winner.entry.threshold }
    // Clearly nearer than any other spell, even loosely: a movement halfway
    // between two spells (letting go of a pinch looks a bit like a pinch and
    // a bit like opening the hand for a fireball) casts nothing.
    const rival = Math.min(...scored.filter((s) => s !== winner).map((s) => s.loose))
    const clear = settings.ratio == null || winner.strict < settings.ratio * rival
    return { best, match: winner.strict < best.threshold && clear ? best : null }
  }

  // The live stretch read as a right hand and as a left hand, the same label
  // for every frame. The tracker's left/right label decides whether a hand is
  // mirrored before comparing, and it is unreliable: it can flicker from
  // frame to frame and is often wrong when the back of the hand faces the
  // camera with fingers curled. So both readings are compared, and the
  // closer one counts. Either hand then works whatever the label says.
  function bothHands(frames, aspect) {
    return ['Right', 'Left'].map((label) =>
      vectorsOf(
        frames.map((frame) => ({ ...frame, label })),
        aspect,
        settings,
      ),
    )
  }

  // The distance from a live stretch to each spell's nearest example (for tests).
  function allDistances(frames, aspect) {
    const views = bothHands(frames, aspect)
    return entries.map((entry) => Math.min(...views.flatMap((live) => entry.examples.map((example) => matchScore(example, live, settings.endWeight, settings.minSpan)))))
  }

  return { entries, settings, classifySegment, allDistances }
}

// Follows a live hand frame by frame and reports when a gesture has been
// completed. push(frame, aspect) returns { best, match } at the moment the
// hand settles after moving, and null otherwise.
//   frame: { t (ms), label, points }
export function createLiveMatcher(recognizer) {
  const { settings } = recognizer
  let history = []
  let recent = [] // the last few movement amounts, for smoothing
  let moving = false

  // How fast the hand is moving: how far it moved over the last ~100 ms,
  // the average of the five landmarks that moved most (so a pinch, where only
  // two fingers move, counts as moving), in palm lengths per 1/30 s (so it
  // doesn't depend on the frame rate). Measuring over 100 ms rather than one
  // frame lets a small, steady movement add up while the tracker's jitter
  // doesn't, so a gentle pinch stands out from a hand held still.
  function movementOf(a, b, aspect) {
    const palm = Math.hypot((b.points[9][0] - b.points[0][0]) * aspect, b.points[9][1] - b.points[0][1]) || 1e-6
    const moved = b.points.map((point, i) => Math.hypot((point[0] - a.points[i][0]) * aspect, point[1] - a.points[i][1]))
    const top = moved.sort((x, y) => y - x).slice(0, 5)
    return (top.reduce((sum, x) => sum + x, 0) / 5 / palm) * (33.3 / Math.max(1, b.t - a.t))
  }

  return {
    push(frame, aspect) {
      const previous = history[history.length - 1]
      if (previous && frame.t - previous.t > 300) {
        // The hand was lost for a moment: start afresh.
        history = []
        recent = []
        moving = false
      }
      history.push(frame)
      while (history.length && history[0].t < frame.t - settings.liveSeconds * 1000) history.shift()
      if (!previous || history.length < 2) return null
      let earlier = history.length - 2
      while (earlier > 0 && frame.t - history[earlier].t < SPAN_MS) earlier--
      recent.push(movementOf(history[earlier], frame, aspect))
      if (recent.length > 2) recent.shift()
      const amount = recent.reduce((a, b) => a + b, 0) / recent.length
      if (amount > settings.moveThreshold) moving = true
      else if (moving && amount < settings.settleThreshold) {
        moving = false
        return recognizer.classifySegment(history.slice(), aspect)
      }
      return null
    },
    reset() {
      history = []
      recent = []
      moving = false
    },
  }
}
