// Generates gesture examples without a camera. Run with `npm run make-spells`.
//
//   npm run make-spells                 creates any of the three spells whose
//                                       file is missing; never touches an
//                                       existing spell
//   npm run make-spells -- --regenerate replaces the gesture examples of all
//                                       four with freshly generated ones
//                                       (their name, animation, audio and
//                                       sensitivity stay as edited)
//
// How a "recording" is made:
//   1. A hand in "palm units" (the palm length, wrist to the base of the
//      middle finger, is 1), a right hand with the palm to the camera, as the
//      camera sees it (not mirrored): fingers up, thumb on the right.
//   2. Fingers are bent into the poses of a gesture (pose() below). Bending
//      works in the picture: with the palm to the camera, a curled finger
//      points at the camera, so its joints move towards the palm centre and
//      it looks shorter.
//   3. The movement between the poses is played at 30 frames a second inside
//      a 2.5 s recording (still, the gesture, still), with:
//        - left or right hand (a left hand is the right one mirrored)
//        - palm or back of the hand to the camera (the back view is also a
//          mirror image, with the same hand)
//        - distance from the camera (how big the hand is in the picture)
//        - speed, a tilt, a turn to the side, where in the picture it is
//        - tracker-like jitter and a slow drift of the whole hand, about as
//          large as measured on real recordings from the owner's camera
//   4. Each recording goes through the same trimming as the in-app recorder
//      (src/gestures/trim.js), which keeps the stretch from moving to settled.
import { readFileSync, writeFileSync } from 'node:fs'
import { trimRecording } from '../src/gestures/trim.js'

const root = new URL('../', import.meta.url)
const spellsDir = new URL('public/library/spells/', root)
const ASPECT = 4 / 3 // the owner's camera is 640 × 480
const FPS = 30
const RECORD_MS = 2500
const MADE_AT = Date.UTC(2026, 10, 5, 12)
const regenerate = process.argv.includes('--regenerate')

// Seeded random numbers, so the generated spells are the same every run.
let seed = 2026
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const between = (a, b) => a + (b - a) * random()
function gaussian() {
  return Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random())
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const scale = (a, k) => [a[0] * k, a[1] * k]
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const length = (a) => Math.hypot(a[0], a[1])
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// An open right hand, palm to the camera, in palm units from the wrist (y
// grows downwards, as in the picture): the average of the owner's real
// tracked open hands (the end of six real Push-Fireball recordings), turned
// upright. Its proportions are those of a real hand as the camera sees it.
const REAL_OPEN = [
  [0, 0], // wrist
  [0.32, -0.16], [0.57, -0.46], [0.71, -0.76], [0.89, -0.99], // thumb
  [0.26, -0.98], [0.28, -1.37], [0.26, -1.62], [0.24, -1.83], // index
  [0, -1], [-0.05, -1.43], [-0.09, -1.7], [-0.13, -1.91], // middle
  [-0.23, -0.92], [-0.33, -1.32], [-0.4, -1.57], [-0.46, -1.79], // ring
  [-0.45, -0.75], [-0.59, -1.05], [-0.67, -1.25], [-0.75, -1.44], // little finger
]
// Every example gets a slightly different hand: fingers a little longer or
// shorter, as different people's hands and camera angles give.
let OPEN = REAL_OPEN
// How much more or less each finger is bent than the gesture says, the same
// all through one example (people hold their fingers a little differently).
let bendOffset = { index: 0, middle: 0, ring: 0, pinky: 0 }
function pickHand(fingerScale, thumbScale) {
  OPEN = REAL_OPEN.map((p, i) => {
    if (i === 0) return p
    const base = i <= 4 ? REAL_OPEN[1] : REAL_OPEN[Math.floor((i - 1) / 4) * 4 + 1]
    const k = i <= 4 ? thumbScale : fingerScale
    if ((i - 1) % 4 === 0) return p
    return add(base, scale(sub(p, base), k))
  })
  PALM_CENTRE = scale([0, 5, 9, 13, 17].reduce((sum, i) => add(sum, OPEN[i]), [0, 0]), 1 / 5)
}
const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] }
let PALM_CENTRE = scale([0, 5, 9, 13, 17].reduce((sum, i) => add(sum, OPEN[i]), [0, 0]), 1 / 5)

// Where each joint of a finger goes when fully curled into the palm.
function curledFinger([mcp, pip]) {
  const m = OPEN[mcp]
  const along = sub(OPEN[pip], m)
  const toPalm = sub(PALM_CENTRE, m)
  return [m, add(m, add(scale(along, 0.55), scale(toPalm, 0.15))), add(m, add(scale(along, 0.35), scale(toPalm, 0.45))), add(m, add(scale(along, 0.1), scale(toPalm, 0.65)))]
}
function fingerAt(name, amount) {
  const joints = FINGERS[name]
  const curled = curledFinger(joints)
  return joints.map((joint, k) => lerp(OPEN[joint], curled[k], amount))
}

// A hand pose:
//   curl:     { index, middle, ring, pinky } from 0 (straight) to 1 (curled)
//   spread:   how far the fingers fan out (0 none, 1 wide)
//   thumbTip: where the thumb tip goes, or null to leave it open
function pose({ curl = {}, spread = 0, thumbTip = null }) {
  const points = OPEN.map((p) => [...p])
  for (const name of Object.keys(FINGERS)) {
    const joints = FINGERS[name]
    const bent = fingerAt(name, Math.min(1, Math.max(0, (curl[name] ?? 0) + bendOffset[name])))
    const side = sub(OPEN[joints[0]], OPEN[9])
    const unit = length(side) > 1e-6 ? scale(side, 1 / length(side)) : [0, 0]
    const fan = { index: 0.18, middle: 0, ring: 0.1, pinky: 0.25 }[name] * spread
    joints.forEach((joint, k) => {
      points[joint] = add(bent[k], scale(unit, fan * length(sub(OPEN[joint], OPEN[joints[0]]))))
    })
  }
  if (spread) {
    const out = sub(OPEN[2], PALM_CENTRE)
    for (const j of [3, 4]) points[j] = add(points[j], scale(out, 0.15 * spread))
  }
  if (thumbTip) {
    // The thumb's middle joint sits a little outside the line to the tip,
    // as a bent thumb does.
    points[4] = thumbTip
    const mid = lerp(points[2], thumbTip, 0.55)
    const outward = sub(mid, PALM_CENTRE)
    points[3] = add(mid, scale(outward, 0.12 / Math.max(0.2, length(outward))))
  }
  return points
}
const mix = (a, b, k) => a.map((p, i) => lerp(p, b[i], k))

// --- the gestures ----------------------------------------------------------
// Each returns { keys: [{ at (ms from the start of the gesture), pose }],
// jolt: a small knock of the whole hand at the end, travel: how far the whole
// hand moves during the gesture (both in palm units), grow: how much bigger
// the hand ends up (pushed towards the camera) }.

// Pinch: the thumb tip and the index fingertip come together. Two styles:
// the other fingers relaxed and half curled, or held up straight ("OK" sign).
function pinchGesture({ style, ms, opening }) {
  const others = style === 'ok' ? { middle: 0.05, ring: 0.08, pinky: 0.1 } : { middle: 0.35, ring: 0.5, pinky: 0.55 }
  const spread = style === 'ok' ? 0.3 : 0
  const indexTipClosed = fingerAt('index', 0.42)[3]
  const meet = add(indexTipClosed, [0.04, 0.02])
  const thumbOpen = lerp(meet, OPEN[4], opening)
  const before = pose({ curl: { index: 0.08, ...others }, spread, thumbTip: thumbOpen })
  const after = pose({ curl: { index: 0.42, ...others, middle: others.middle + 0.04 }, spread, thumbTip: meet })
  // The hand dips a little as the fingers close, as real pinches do.
  return { keys: [{ at: 0, pose: before }, { at: ms, pose: after }], jolt: 0.03, travel: [between(-0.1, 0.1), between(0.05, 0.3)] }
}

// Snap: the thumb presses on the middle fingertip, the ring and little
// fingers are folded. The middle finger slips off and strikes the palm, the
// thumb shoots forward along the side of the index finger, and the hand
// jerks with the snap.
function snapGesture({ ms, press }) {
  const middleHalf = fingerAt('middle', 0.45)
  const curlBefore = { index: 0.22, middle: 0.45, ring: 0.9, pinky: 0.9 }
  const relaxed = pose({ curl: { index: 0.2, middle: 0.4, ring: 0.85, pinky: 0.85 }, thumbTip: add(middleHalf[3], [0.12, 0.08]) })
  const pressed = pose({ curl: curlBefore, thumbTip: middleHalf[3] })
  const indexSide = add(lerp(OPEN[5], fingerAt('index', 0.12)[1], between(0.35, 0.75)), [between(0.05, 0.18), 0])
  const after = pose({ curl: { index: 0.12, middle: 1, ring: 0.9, pinky: 0.9 }, thumbTip: indexSide })
  return {
    keys: [
      { at: 0, pose: relaxed },
      { at: press, pose: pressed }, // pressing the fingers together, building up
      { at: press + ms, pose: after }, // the snap itself
    ],
    jolt: 0.12,
  }
}

// Push-Fireball: a fist with the thumb
// across the fingers, flung open and pushed towards the camera (it grows).
function fireballGesture({ ms, grow }) {
  const fistCurl = { index: 1, middle: 1, ring: 1, pinky: 1 }
  const fist = pose({ curl: fistCurl })
  const before = pose({ curl: fistCurl, thumbTip: scale(add(fist[6], fist[10]), 0.5) })
  const after = pose({ spread: between(0, 0.3) })
  return { keys: [{ at: 0, pose: before }, { at: ms, pose: after }], jolt: 0, grow, travel: [between(-0.15, 0.15), between(-0.25, 0)] }
}

// Finger-Slowdown: the middle finger raised on its own. From a fist (or a
// loosely curled hand), the middle finger straightens up while the others
// stay curled and the thumb folds over them; the hand lifts a little.
function middleFingerGesture({ ms, fromFist }) {
  const fistCurl = { index: 1, middle: 1, ring: 1, pinky: 1 }
  const fist = pose({ curl: fistCurl })
  const thumbOver = lerp(fist[6], fist[14], between(0.3, 0.5))
  const before = fromFist
    ? pose({ curl: fistCurl, thumbTip: scale(add(fist[6], fist[10]), 0.5) })
    : pose({ curl: { index: 0.4, middle: 0.35, ring: 0.5, pinky: 0.55 }, thumbTip: lerp(OPEN[4], thumbOver, 0.4) })
  const after = pose({ curl: { index: 0.95, middle: between(0, 0.08), ring: 0.95, pinky: 0.95 }, thumbTip: thumbOver })
  return {
    keys: [{ at: 0, pose: before }, { at: ms, pose: after }],
    jolt: 0.03,
    grow: between(1, 1.08),
    travel: [between(-0.05, 0.05), between(-0.25, -0.05)],
  }
}

// Index-Sprout: the index finger raised on its own, pointing up, from a fist
// (or a loosely curled hand), with the thumb tucked in over the curled middle
// finger (not sticking out). The hand lifts a little.
function indexFingerGesture({ ms, fromFist }) {
  const fistCurl = { index: 1, middle: 1, ring: 1, pinky: 1 }
  const fist = pose({ curl: fistCurl })
  const tucked = lerp(fist[10], fist[14], between(0, 0.35))
  const before = fromFist
    ? pose({ curl: fistCurl, thumbTip: scale(add(fist[6], fist[10]), 0.5) })
    : pose({ curl: { index: 0.35, middle: 0.45, ring: 0.5, pinky: 0.55 }, thumbTip: lerp(OPEN[4], tucked, 0.5) })
  const after = pose({
    curl: { index: between(0, 0.1), middle: between(0.85, 1), ring: between(0.85, 1), pinky: between(0.85, 1) },
    thumbTip: tucked,
  })
  return {
    keys: [{ at: 0, pose: before }, { at: ms, pose: after }],
    jolt: 0.03,
    grow: between(1, 1.06),
    travel: [between(-0.05, 0.05), between(-0.25, -0.05)],
  }
}

function poseAt(keys, t) {
  if (t <= keys[0].at) return keys[0].pose
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].at) return mix(keys[i - 1].pose, keys[i].pose, smoothstep((t - keys[i - 1].at) / (keys[i].at - keys[i - 1].at)))
  }
  return keys[keys.length - 1].pose
}

// One 2.5 s recording: still, the gesture, still again.
//   hand: 'Right' | 'Left'; view: 'palm' | 'back'
//   size: palm length as a fraction of the picture's height (distance:
//         about 0.13 far from the camera, 0.35 close)
function record(gesture, { hand, view, size, tilt, turn, x, y }) {
  const startMs = between(600, 1000)
  const end = gesture.keys[gesture.keys.length - 1].at
  const mirror = (hand === 'Left') !== (view === 'back') ? -1 : 1
  const cos = Math.cos((tilt * Math.PI) / 180)
  const sin = Math.sin((tilt * Math.PI) / 180)
  const squash = Math.cos((turn * Math.PI) / 180) // turned to the side, the hand looks narrower
  const drift = [between(0, 6.28), between(0, 6.28), between(0.03, 0.07)]
  const frames = []
  for (let t = 0; t <= RECORD_MS; t += 1000 / FPS + (random() < 0.15 ? 1000 / FPS : 0)) {
    const local = t - startMs
    const shape = poseAt(gesture.keys, local)
    const k = smoothstep(local / Math.max(1, end))
    const grow = 1 + ((gesture.grow ?? 1) - 1) * k
    // The knock at the end of the gesture, dying away over about 150 ms.
    const after = local - end
    const knock = after > -40 && after < 160 ? gesture.jolt * Math.sin((Math.PI * (after + 40)) / 200) : 0
    const wander = [drift[2] * Math.sin(t / 700 + drift[0]), drift[2] * Math.sin(t / 900 + drift[1])]
    const shared = [gaussian() * 0.004, gaussian() * 0.004]
    frames.push({
      t: Math.round(t),
      label: hand,
      points: shape.map((p, i) => {
        let q = add(PALM_CENTRE, scale(sub(p, PALM_CENTRE), grow))
        q = [q[0] * squash * mirror, q[1]]
        q = [q[0] * cos - q[1] * sin, q[0] * sin + q[1] * cos]
        const travel = scale(gesture.travel ?? [0, 0], k)
        q = add(q, add(add(wander, travel), [0, knock]))
        q = add(q, add(shared, [gaussian() * 0.007, gaussian() * 0.007]))
        const round = (v) => Math.round(v * 10000) / 10000
        // Palm units to fractions of the picture (x is in widths).
        return [round(x + (q[0] * size) / ASPECT), round(y + q[1] * size), round(-0.02 * length(OPEN[i]))]
      }),
    })
  }
  return frames
}

// Moves a whole recording so the hand stays inside the picture all through
// it (a real camera can't track fingertips outside it), with a small margin.
function inFrame(frames) {
  const MARGIN = 0.03
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const frame of frames) {
    for (const [x, y] of frame.points) {
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  // Too big to fit (very close and pushed at the camera): shrink about its centre.
  const fit = Math.min(1, (1 - 2 * MARGIN) / (right - left), (1 - 2 * MARGIN) / (bottom - top))
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const sx = (x) => cx + (x - cx) * fit
  const sy = (y) => cy + (y - cy) * fit
  const shift = (low, high) => (low < MARGIN ? MARGIN - low : high > 1 - MARGIN ? 1 - MARGIN - high : 0)
  const dx = shift(sx(left), sx(right))
  const dy = shift(sy(top), sy(bottom))
  const round = (v) => Math.round(v * 10000) / 10000
  return frames.map((frame) => ({ ...frame, points: frame.points.map(([x, y, z]) => [round(sx(x) + dx), round(sy(y) + dy), z]) }))
}

function example(makeGesture, options, index) {
  pickHand(between(0.88, 1.1), between(0.9, 1.1))
  bendOffset = { index: between(-0.06, 0.06), middle: between(-0.08, 0.08), ring: between(-0.12, 0.12), pinky: between(-0.12, 0.12) }
  const gesture = makeGesture()
  const result = trimRecording(inFrame(record(gesture, options)), ASPECT, 0)
  if (result.error) throw new Error(result.error)
  return { ...result.example, recordedAt: MADE_AT + index * 60000 }
}

// Ten examples, five right hand and five left: both hands, near and far, quick and slow, a little tilted
// and turned, in different places in the picture.
const SIZES = [0.14, 0.3, 0.2, 0.35, 0.25, 0.17, 0.32, 0.15, 0.27, 0.22]
const COUNT = SIZES.length
function placement(i, view = 'palm') {
  const hand = i % 2 ? 'Left' : 'Right'
  const size = SIZES[i]
  return {
    hand,
    view,
    size,
    tilt: between(-35, 35),
    turn: between(0, 45),
    // A right hand appears on the left of the (unmirrored) picture.
    x: hand === 'Right' ? between(0.25, 0.45) : between(0.55, 0.75),
    // The wrist low enough that the fingertips (about 2.2 palm lengths above
    // it, more for a hand pushed towards the camera) stay inside the picture,
    // as a real camera needs to track them.
    y: Math.min(0.95, between(0.08 + 2.4 * size, 0.97)),
  }
}

function pinchExamples() {
  return Array.from({ length: COUNT }, (_, i) =>
    example(() => pinchGesture({ style: i % 4 < 2 ? 'relaxed' : 'ok', ms: 150 + ((i * 7) % COUNT) * 32, opening: between(0.6, 1) }), placement(i), i),
  )
}

function snapExamples() {
  // Four (two of each hand) seen from the back of the hand: snapping with the
  // palm towards yourself shows the camera the back of the hand.
  return Array.from({ length: COUNT }, (_, i) =>
    example(() => snapGesture({ ms: 50 + ((i * 3) % COUNT) * 7, press: between(150, 350) }), placement(i, i % 4 >= 2 && i < 8 ? 'back' : 'palm'), i),
  )
}

const GENERATED_NOTE = 'Its 10 examples were generated by scripts/make-spells.js (five right hand, five left, near and far, quick and slow), not recorded.'

const spells = [
  {
    file: 'pinch-coins.json',
    regenerate: true,
    examples: pinchExamples,
    spell: {
      id: 'builtin:pinch-coins',
      name: 'Pinch-Coins',
      description: `Pinch your thumb and index finger together: a burst of gold coins flies from your fingers with a chime. ${GENERATED_NOTE}`,
      animationId: 'builtin:coins',
      audioId: 'builtin:spark-chime',
      sensitivity: 1,
    },
  },
  {
    file: 'snap-brightness.json',
    regenerate: true,
    examples: snapExamples,
    spell: {
      id: 'builtin:snap-brightness',
      name: 'Snap-Brightness',
      description: `Snap your middle finger against your thumb: a point of light flares at your index fingertip and shines for a few seconds. ${GENERATED_NOTE}`,
      animationId: 'builtin:illumination',
      audioId: 'builtin:light-swell',
      sensitivity: 1,
    },
  },
  {
    file: 'push-fireball.json',
    regenerate: true,
    examples: () => Array.from({ length: COUNT }, (_, i) => example(() => fireballGesture({ ms: 220 + ((i * 3) % COUNT) * 30, grow: between(1.35, 1.9) }), placement(i), i)),
    spell: {
      id: 'builtin:push-fireball',
      name: 'Push-Fireball',
      description:
        `Make a fist, then fling your hand open and push it towards the camera: a fireball forms at your palm and rushes at the viewer, with a crackling roar. ${GENERATED_NOTE}`,
      animationId: 'builtin:fireball',
      audioId: 'builtin:fire-crackle',
      sensitivity: 1,
    },
  },
  {
    file: 'finger-slowdown.json',
    regenerate: true,
    // Six of the ten (three of each hand) show the back of the hand, the
    // usual way to show the middle finger; seven start from a fist.
    examples: () =>
      Array.from({ length: COUNT }, (_, i) =>
        example(() => middleFingerGesture({ ms: 200 + ((i * 3) % COUNT) * 28, fromFist: i % 3 !== 2 }), placement(i, i < 6 ? 'back' : 'palm'), i),
      ),
    spell: {
      id: 'builtin:finger-slowdown',
      name: 'Finger-Slowdown',
      description: `Raise your middle finger from a fist: a gothic clock appears above it, its hands spinning fast and slowing tick by tick to a stop, as time winds down. ${GENERATED_NOTE}`,
      animationId: 'builtin:clock',
      audioId: 'builtin:clock-tick',
      sensitivity: 1,
    },
  },
  {
    file: 'index-sprout.json',
    regenerate: true,
    // Half seen from the back of the hand; most start from a fist.
    examples: () =>
      Array.from({ length: COUNT }, (_, i) =>
        example(() => indexFingerGesture({ ms: 200 + ((i * 3) % COUNT) * 28, fromFist: i % 3 !== 2 }), placement(i, i % 4 < 2 ? 'back' : 'palm'), i),
      ),
    spell: {
      id: 'builtin:index-sprout',
      name: 'Index-Sprout',
      description: `Raise your index finger from a fist, thumb tucked in: your finger turns into a branch that grows past your fingertip and opens into a sprout with two leaves, creaking as it grows. ${GENERATED_NOTE}`,
      animationId: 'builtin:sprout',
      audioId: 'builtin:growth',
      sensitivity: 1,
    },
  },
]

const indexUrl = new URL('index.json', spellsDir)
const index = JSON.parse(readFileSync(indexUrl, 'utf8'))
for (const { file, regenerate: canRegenerate, examples, spell } of spells) {
  const url = new URL(file, spellsDir)
  let existing = null
  try {
    existing = JSON.parse(readFileSync(url, 'utf8'))
  } catch {
    // no file yet
  }
  if (!existing) {
    writeFileSync(url, JSON.stringify({ ...spell, createdAt: MADE_AT, gesture: { examples: examples() } }) + '\n')
    console.log(`${file}: created with generated examples`)
    if (!index.includes(file)) index.push(file)
  } else if (regenerate && canRegenerate) {
    const made = examples()
    writeFileSync(url, JSON.stringify({ ...existing, description: spell.description, gesture: { examples: made } }) + '\n')
    console.log(`${file}: gesture examples replaced with ${made.length} generated ones`)
  } else {
    console.log(`${file}: already exists, left as it is`)
  }
}
writeFileSync(indexUrl, JSON.stringify(index, null, 2) + '\n')
