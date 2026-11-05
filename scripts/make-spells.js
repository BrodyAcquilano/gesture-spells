// Generates the built-in Snap-Brightness and Push-Fireball spells, five example
// recordings each, without a camera. Run with `npm run make-spells`.
//
// The hand is not invented from scratch: it is the real hand from the first
// frame of the Pinch coins recordings (public/library/spells/pinch-coins.json),
// so its proportions are those of a real tracked hand. Its fingers are then
// bent frame by frame into each gesture, the whole hand is moved, scaled and
// turned a little differently for each example, and tracker-like jitter is
// added. Each 2.5 s "recording" then goes through the same trimming as the
// in-app recorder (src/gestures/trim.js).
//
// Finger bending works in the image plane. With the palm facing the camera, a
// curled finger points towards the camera, so in the picture its joints move
// towards the centre of the palm and the finger looks shorter.
import { readFileSync, writeFileSync } from 'node:fs'
import { trimRecording } from '../src/gestures/trim.js'

const root = new URL('../', import.meta.url)
const spellsDir = new URL('public/library/spells/', root)
const pinch = JSON.parse(readFileSync(new URL('pinch-coins.json', spellsDir), 'utf8'))
const source = pinch.gesture.examples[0]
const ASPECT = source.aspect
const LABEL = source.frames[0].label
const BASE = source.frames[0].points.map(([x, y, z]) => [x, y, z])
const FPS = 30
const RECORD_MS = 2500
const MADE_AT = Date.UTC(2026, 10, 4, 12)

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

const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const scale = (a, k) => [a[0] * k, a[1] * k]
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const length = (a) => Math.hypot(a[0], a[1])

// Work in pixel-like units (x × aspect) so bends and turns are not squashed.
const toPx = (p) => [p[0] * ASPECT, p[1]]
const fromPx = (p) => [p[0] / ASPECT, p[1]]
const OPEN = BASE.map(toPx)
const PALM_CENTRE = scale([0, 5, 9, 13, 17].reduce((sum, i) => add(sum, OPEN[i]), [0, 0]), 1 / 5)

// Where each joint of a finger goes when fully curled.
function curledFinger([mcp, pip]) {
  const m = OPEN[mcp]
  const along = sub(OPEN[pip], m)
  const toPalm = sub(PALM_CENTRE, m)
  return [m, add(m, add(scale(along, 0.55), scale(toPalm, 0.15))), add(m, add(scale(along, 0.35), scale(toPalm, 0.45))), add(m, add(scale(along, 0.1), scale(toPalm, 0.65)))]
}

// A hand pose from a description:
//   curl:   { index, middle, ring, pinky } from 0 (straight) to 1 (curled)
//   spread: how far fingers fan out (0 none, 1 wide)
//   thumbTip: where the thumb tip goes (pixel units), or null to leave it
function pose({ curl = {}, spread = 0, thumbTip = null }) {
  const points = OPEN.map((p) => [...p])
  const middleBase = OPEN[9]
  for (const [name, joints] of Object.entries(FINGERS)) {
    const amount = curl[name] ?? 0
    const curled = curledFinger(joints)
    const lateral = sub(OPEN[joints[0]], middleBase)
    const side = length(lateral) > 1e-6 ? scale(lateral, 1 / length(lateral)) : [0, 0]
    const fan = { index: 0.18, middle: 0, ring: 0.1, pinky: 0.25 }[name] * spread
    joints.forEach((joint, k) => {
      let p = lerp(OPEN[joint], curled[k], amount)
      p = add(p, scale(side, fan * length(sub(OPEN[joint], OPEN[joints[0]]))))
      points[joint] = p
    })
  }
  if (spread) {
    // The thumb swings out a little too.
    const out = sub(OPEN[2], PALM_CENTRE)
    for (const j of [3, 4]) points[j] = add(points[j], scale(out, 0.15 * spread))
  }
  if (thumbTip) {
    points[4] = thumbTip
    points[3] = lerp(points[2], thumbTip, 0.55)
  }
  return points
}

const mix = (a, b, k) => a.map((p, i) => lerp(p, b[i], k))
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// --- the gestures ----------------------------------------------------------

function snapPoses() {
  // Before: thumb pressed against the middle fingertip, ring and little
  // fingers folded. After: the middle finger has snapped down into the palm,
  // the thumb has slid forward along the index finger, and the index finger
  // points up, where the light appears.
  const middleHalf = curledFinger(FINGERS.middle).map((c, k) => lerp(OPEN[FINGERS.middle[k]], c, 0.5))
  const before = pose({ curl: { index: 0.25, middle: 0.5, ring: 0.85, pinky: 0.85 }, thumbTip: middleHalf[3] })
  const indexBent = curledFinger(FINGERS.index).map((c, k) => lerp(OPEN[FINGERS.index[k]], c, 0.15))
  const after = pose({ curl: { index: 0.1, middle: 1, ring: 0.85, pinky: 0.85 }, thumbTip: lerp(OPEN[5], indexBent[1], 0.5) })
  return { before, after, moveMs: () => between(70, 130), grow: 1, jolt: 0.012 }
}

function fireballPoses() {
  // Before: a fist with the thumb folded across the fingers. After: the hand
  // flung open, fingers spread, and pushed towards the camera (it grows).
  const fistCurl = { index: 1, middle: 1, ring: 1, pinky: 1 }
  const fist = pose({ curl: fistCurl })
  const across = scale(add(fist[6], fist[10]), 0.5)
  const before = pose({ curl: fistCurl, thumbTip: across })
  const after = pose({ spread: 1 })
  return { before, after, moveMs: () => between(240, 400), grow: 1.3, jolt: 0 }
}

// One 2.5 s recording: still, the movement, then still again.
function record({ before, after, moveMs, grow, jolt }) {
  const startMs = between(550, 1000)
  const duration = moveMs()
  const turn = (between(-8, 8) * Math.PI) / 180
  const size = between(0.88, 1.12)
  const shift = [between(-0.06, 0.06) * ASPECT, between(-0.05, 0.05)]
  const wrist = OPEN[0]
  const frames = []
  for (let t = 0; t <= RECORD_MS; t += 1000 / FPS) {
    const k = smoothstep((t - startMs) / duration)
    const points = mix(before, after, k)
    // The push towards the camera: the hand grows about its palm centre.
    const g = 1 + (grow - 1) * k
    const joltY = jolt * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - startMs) / duration)))
    frames.push({
      t: Math.round(t),
      label: LABEL,
      points: points.map((p, i) => {
        let q = add(PALM_CENTRE, scale(sub(p, PALM_CENTRE), g))
        const r = sub(q, wrist)
        q = add(wrist, scale([r[0] * Math.cos(turn) - r[1] * Math.sin(turn), r[0] * Math.sin(turn) + r[1] * Math.cos(turn)], size))
        q = add(q, add(shift, [0, joltY]))
        const [x, y] = fromPx(q)
        const round = (v) => Math.round(v * 10000) / 10000
        return [round(x + gaussian() * 0.002), round(y + gaussian() * 0.0025), BASE[i][2]]
      }),
    })
  }
  return frames
}

function makeExamples(gesture, count = 5) {
  const examples = []
  while (examples.length < count) {
    const result = trimRecording(record(gesture), ASPECT, 0)
    if (result.error) throw new Error(result.error)
    examples.push({ ...result.example, recordedAt: MADE_AT + examples.length * 60000 })
  }
  return examples
}

const spells = [
  {
    file: 'snap-brightness.json',
    spell: {
      id: 'builtin:snap-brightness',
      name: 'Snap-Brightness',
      description:
        'Snap your middle finger against your thumb: a point of light flares at your index fingertip and shines for a few seconds. The five examples were generated from a real hand shape, not recorded.',
      animationId: 'builtin:illumination',
      audioId: 'builtin:light-swell',
      sensitivity: 1,
      createdAt: MADE_AT,
      gesture: { examples: makeExamples(snapPoses()) },
    },
  },
  {
    file: 'push-fireball.json',
    spell: {
      id: 'builtin:push-fireball',
      name: 'Push-Fireball',
      description:
        'Make a fist, then fling your hand open and push it towards the camera: a fireball forms at your palm and rushes at the viewer, with a crackling roar. The five examples were generated from a real hand shape, not recorded.',
      animationId: 'builtin:fireball',
      audioId: 'builtin:fire-crackle',
      sensitivity: 1,
      createdAt: MADE_AT,
      gesture: { examples: makeExamples(fireballPoses()) },
    },
  },
]

// Spells are editable in the app, so if a spell's file already exists only
// its gesture examples are replaced: its name, description, animation, audio
// and sensitivity stay as they were edited. A spell deleted in the app is
// made again (and listed again) by running this.
const indexUrl = new URL('index.json', spellsDir)
const index = JSON.parse(readFileSync(indexUrl, 'utf8'))
for (const { file, spell } of spells) {
  const url = new URL(file, spellsDir)
  let existing = null
  try {
    existing = JSON.parse(readFileSync(url, 'utf8'))
  } catch {
    // not there yet
  }
  const saved = existing ? { ...existing, gesture: spell.gesture } : spell
  writeFileSync(url, JSON.stringify(saved) + '\n')
  if (!index.includes(file)) index.push(file)
  console.log(`${file}: ${spell.gesture.examples.map((e) => `${e.duration} ms`).join(', ')}${existing ? ' (kept its edited details)' : ''}`)
}
writeFileSync(indexUrl, JSON.stringify(index, null, 2) + '\n')
console.log('Updated public/library/spells/index.json')
