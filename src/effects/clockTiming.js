// When the clock ticks, shared by the Clock animation (clock.js) and the
// Clock-Tick sound (clockSound.js), so every tick you hear is the second hand
// jumping. No browser imports, so the Node check can use it.
//
// The ticks start very fast (one every 60 ms, a blur of ticking) and each gap
// is 17% longer than the one before, so time seems to wind down: about 16
// ticks over 3.4 s, the last ones half a second apart.

export const FIRST_GAP = 0.06 // seconds between the first two ticks
export const GROWTH = 1.17 // each gap is this many times the one before
export const LAST_TICK_BY = 3.4 // no tick after this many seconds

export function tickTimes() {
  const times = []
  let t = 0
  let gap = FIRST_GAP
  while (t <= LAST_TICK_BY) {
    times.push(t)
    t += gap
    gap *= GROWTH
  }
  return times
}
