// Tunes the recogniser's settings on the gesture examples in the
// spellbook. Run with `npm run tune` (it takes a few minutes).
//
// Each example is replayed as if it were being performed live: the hand
// holds still for a second, does the gesture, then holds still again. The
// recogniser it is replayed to has every spell but not that example (it has
// never seen it), and goes through the same live matcher as the app. Each
// replay is scored:
//   correct  the right spell cast once, within 0.25 s of the moment the hand
//            completed the gesture (so its animation appears where the hand is)
//   late     the right spell, but more than 0.25 s off (the hand has moved,
//            so the animation appears in the wrong place)
//   wrong    a different spell cast
//   missed   nothing cast
// The same gesture played backwards should cast nothing; a cast there is a
// false alarm.
//
// It starts from the settings in src/gestures/recognizer.js, tries changing
// one setting at a time, keeps any change that scores better, and repeats
// until nothing improves. It prints the results and the best settings, which
// can then be copied into DEFAULT_SETTINGS.
import { readFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, buildRecognizer, createLiveMatcher } from '../src/gestures/recognizer.js'
import { arrivalTime } from '../src/gestures/features.js'

const spellsDir = new URL('../public/library/spells/', import.meta.url)
const spells = JSON.parse(readFileSync(new URL('index.json', spellsDir), 'utf8'))
  .map((file) => JSON.parse(readFileSync(new URL(file, spellsDir), 'utf8')))
  .filter((spell) => (spell.gesture?.examples?.length ?? 0) >= 2)
const onlyReal = process.argv.includes('--quick')

const STEP = 1000 / 30
const HOLD_FRAMES = 30
const ON_TIME_MS = 250

// A live-like stream: hold, gesture, hold. Returns the frames and when, in
// the stream, the gesture completes.
function streamOf(example, reversed = false) {
  let frames = example.frames
  if (reversed) frames = [...frames].reverse().map((frame, i) => ({ ...frame, t: example.frames[i].t }))
  const out = []
  let t = 0
  for (let i = 0; i < HOLD_FRAMES; i++) out.push({ ...frames[0], t: (t += STEP) })
  const start = t
  for (const frame of frames) out.push({ ...frame, t: start + frame.t })
  t = out[out.length - 1].t
  for (let i = 0; i < HOLD_FRAMES; i++) out.push({ ...frames[frames.length - 1], t: (t += STEP) })
  return { frames: out, completesAt: start + arrivalTime(example.frames, example.aspect) }
}

// Feeds the stream through the live matcher, like the app does, and lists
// the casts.
function replay(recognizer, frames, aspect) {
  const matcher = createLiveMatcher(recognizer)
  const casts = []
  for (const frame of frames) {
    const result = matcher.push(frame, aspect)
    if (result?.match) casts.push({ t: frame.t, id: result.match.spell.id })
  }
  return casts
}

export function evaluate(settings, { verbose = false } = {}) {
  const totals = { correct: 0, late: 0, wrong: 0, missed: 0, falseAlarm: 0, offsets: [] }
  const perSpell = {}
  for (const spell of spells) {
    const tally = (perSpell[spell.name] = { correct: 0, late: 0, wrong: 0, missed: 0, falseAlarm: 0 })
    spell.gesture.examples.forEach((example, k) => {
      if (onlyReal && example.frames.length < 2) return
      // A spell sharing this one's gesture (a copy) is never ticked with it.
      const pool = spells.filter((s) => s === spell || JSON.stringify(s.gesture.examples) !== JSON.stringify(spell.gesture.examples))
      const recognizer = buildRecognizer(
        pool.map((s) => (s === spell ? { ...s, gesture: { examples: s.gesture.examples.filter((_, j) => j !== k) } } : s)),
        settings,
      )
      const forward = streamOf(example)
      const casts = replay(recognizer, forward.frames, example.aspect)
      const own = casts.filter((c) => c.id === spell.id)
      let outcome
      if (casts.some((c) => c.id !== spell.id)) outcome = 'wrong'
      else if (!own.length) outcome = 'missed'
      else {
        const offset = own[0].t - forward.completesAt
        totals.offsets.push(offset)
        outcome = Math.abs(offset) <= ON_TIME_MS ? 'correct' : 'late'
      }
      totals[outcome]++
      tally[outcome]++
      const backward = streamOf(example, true)
      if (replay(recognizer, backward.frames, example.aspect).length) {
        totals.falseAlarm++
        tally.falseAlarm++
      }
      if (verbose && outcome !== 'correct') {
        const detail = casts.map((c) => `${c.id.replace('builtin:', '')} at ${((c.t - forward.completesAt) / 1000).toFixed(2)} s`).join(', ')
        console.log(`  ${spell.name} ${k + 1} (${example.frames[0].label}, ${Math.round(example.duration)} ms): ${outcome}${detail ? ` (${detail})` : ''}`)
      }
    })
  }
  totals.perSpell = perSpell
  // Wrong spells and false alarms are the worst: an effect that shouldn't be there.
  totals.score = 2 * totals.correct + totals.late - 3 * totals.wrong - totals.missed - 2 * totals.falseAlarm
  return totals
}

function describe(r) {
  const offsets = r.offsets.map((o) => Math.abs(o)).sort((a, b) => a - b)
  const median = offsets.length ? offsets[Math.floor(offsets.length / 2)] : NaN
  return `correct ${r.correct}, late ${r.late}, wrong spell ${r.wrong}, missed ${r.missed}, false alarms ${r.falseAlarm} (score ${r.score}, median timing ${Math.round(median)} ms)`
}

// The settings tried, one at a time.
const CHOICES = {
  stepMs: [30, 40, 60],
  liveSeconds: [2, 3, 4],
  endWeight: [0, 0.3, 0.6, 1],
  limitSlack: [1.2, 1.5, 2, 2.5, 3],
  limitQuantile: [0.75, 0.9, 1],
  margin: [null, 0.8, 1, 1.2],
  moveThreshold: [0.025, 0.035, 0.05, 0.07],
  settleThreshold: [0.012, 0.02, 0.03],
  'features.shapeWeight': [0, 0.25, 0.5, 1],
  'features.tipWeight': [0, 0.5, 1, 2],
  'features.pathWeight': [1, 2, 4, 6],
  'features.facingWeight': [0, 1, 3],
}

function withSetting(settings, key, value) {
  if (key.startsWith('features.')) return { ...settings, features: { ...settings.features, [key.slice(9)]: value } }
  return { ...settings, [key]: value }
}
const valueOf = (settings, key) => (key.startsWith('features.') ? settings.features[key.slice(9)] : settings[key])

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('tune-recognizer.js')) {
  console.log(`Spells: ${spells.map((s) => `${s.name} (${s.gesture.examples.length})`).join(', ')}\n`)
  let best = structuredClone(DEFAULT_SETTINGS)
  let bestResult = evaluate(best, { verbose: true })
  console.log(`Current settings: ${describe(bestResult)}\n`)
  for (let round = 1; round <= 3; round++) {
    let improved = false
    for (const [key, values] of Object.entries(CHOICES)) {
      for (const value of values) {
        if (value === valueOf(best, key)) continue
        const candidate = withSetting(best, key, value)
        const result = evaluate(candidate)
        if (result.score > bestResult.score) {
          best = candidate
          bestResult = result
          improved = true
          console.log(`round ${round}: ${key} = ${value} → ${describe(result)}`)
        }
      }
    }
    if (!improved) break
  }
  console.log(`\nBest: ${describe(bestResult)}`)
  for (const [name, t] of Object.entries(bestResult.perSpell)) console.log(`  ${name}: correct ${t.correct}, late ${t.late}, wrong ${t.wrong}, missed ${t.missed}, false alarms ${t.falseAlarm}`)
  console.log('\nRemaining problems with the best settings:')
  evaluate(best, { verbose: true })
  console.log('\nBest settings:')
  console.log(JSON.stringify(best, (k, v) => (v === Infinity ? 'Infinity' : v), 2))
}
