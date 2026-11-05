// Dynamic time warping: how different two movements are, allowing one to be
// faster or slower than the other in places.
//
// Comparing frame 1 with frame 1, frame 2 with frame 2 and so on fails as soon
// as one pinch closes a little later than the other. DTW instead finds the
// cheapest way to pair up the frames of `a` and `b` in order, where a frame
// may be paired with several frames of the other movement (that is the
// "warping"). cost[i][j] is the cheapest total for pairing the first i frames
// of a with the first j frames of b:
//
//   cost[i][j] = distance(a[i], b[j]) + min(cost[i-1][j],    a waits
//                                          cost[i][j-1],    b waits
//                                          cost[i-1][j-1])  both move on
//
// The answer is cost[n][m], divided by n + m so longer movements don't score
// worse just for having more frames. Only one previous row is kept in memory.
import { distance } from './features.js'

export function dtw(a, b) {
  const n = a.length
  const m = b.length
  let previous = new Float64Array(m + 1).fill(Infinity)
  previous[0] = 0
  for (let i = 1; i <= n; i++) {
    const current = new Float64Array(m + 1).fill(Infinity)
    for (let j = 1; j <= m; j++) {
      const best = Math.min(previous[j], current[j - 1], previous[j - 1])
      current[j] = distance(a[i - 1], b[j - 1]) + best
    }
    previous = current
  }
  return previous[m] / (n + m)
}
