// Where an animation appears on the hand.
//
// An animation on its own doesn't know where it belongs: coins burst from a
// pinch, bubbles rise from a fingertip. Every animation can have a
// `placement` in its library entry, set in the Animations tab. Animations
// drawn by code have their own defaults (src/effects/animations.js), used
// until changed; an imported file (video or animated image) starts at the
// centre of the palm.
//
//   anchor  the point on the hand it is attached to (ANCHORS below): the top
//           of a finger, slightly lower on one, between two fingertips, or
//           the centre of the palm (the default)
//   size    an imported file's height, in palm lengths (wrist to the base of
//           the middle finger), so it scales with the hand: bigger when the
//           hand is near the camera, smaller when far
//   scale   an animation drawn by code: its size × this (1: as designed)
//   follow  true: it moves with the hand while it plays; false: it stays
//           where the spell was cast (some drawn by code, like Coins, always
//           stay: they burst out from where they're cast)
//
// Which point of the animation goes on the hand point follows from the
// position (pivotFor): on a finger, the middle of its bottom edge, since
// things come out of a finger (bubbles, a plant); between fingers or on the
// palm, its centre. So an animation for a finger is drawn coming out of the
// middle of its bottom edge, and any other is drawn centred.
//
// No browser imports: the dev server (server/storage.js) checks placements
// with this file too.

// The points an animation can be attached to, in groups for the dropdown.
// The landmarks behind each are in anchorPoint (src/tracking/landmarks.js).
export const ANCHOR_GROUPS = [
  {
    label: 'Top of a finger',
    anchors: { thumbTip: 'Top of the thumb', indexTip: 'Top of the index finger', middleTip: 'Top of the middle finger', ringTip: 'Top of the ring finger', pinkyTip: 'Top of the little finger' },
  },
  {
    label: 'Slightly lower on a finger (the last joint)',
    anchors: { thumbLow: 'Thumb, slightly lower', indexLow: 'Index finger, slightly lower', middleLow: 'Middle finger, slightly lower', ringLow: 'Ring finger, slightly lower', pinkyLow: 'Little finger, slightly lower' },
  },
  {
    label: 'Between two fingertips',
    anchors: { pinch: 'Between thumb and index (pinch)', indexMiddle: 'Between index and middle', middleRing: 'Between middle and ring', ringPinky: 'Between ring and little finger' },
  },
  { label: 'Palm', anchors: { palm: 'Centre of the palm' } },
]
export const ANCHORS = Object.assign({}, ...ANCHOR_GROUPS.map((group) => group.anchors))

// Which point of the animation goes on the hand point: 'bottom' (the middle
// of its bottom edge) on a finger, 'center' between fingers or on the palm.
export function pivotFor(anchor) {
  return /Tip$|Low$/.test(anchor) ? 'bottom' : 'center'
}

export const DEFAULT_PLACEMENT = { anchor: 'palm', size: 3, scale: 1, follow: true }

// A placement with every field valid, filling in `defaults` (an animation
// drawn by code passes its own); anything unknown is dropped.
export function cleanPlacement(placement, defaults = DEFAULT_PLACEMENT) {
  const p = placement && typeof placement === 'object' ? placement : {}
  const d = { ...DEFAULT_PLACEMENT, ...defaults }
  const size = Number(p.size)
  const scale = Number(p.scale)
  return {
    anchor: Object.hasOwn(ANCHORS, p.anchor) ? p.anchor : d.anchor,
    size: Number.isFinite(size) && size > 0 ? Math.min(20, size) : d.size,
    scale: Number.isFinite(scale) && scale > 0 ? Math.min(4, Math.max(0.25, scale)) : d.scale,
    follow: typeof p.follow === 'boolean' ? p.follow : d.follow,
  }
}

// The finger an anchor is on ('index' for 'indexTip' or 'indexLow'), or null
// between fingers and on the palm.
export function fingerOf(anchor) {
  const match = /^(thumb|index|middle|ring|pinky)(Tip|Low)$/.exec(anchor)
  return match ? match[1] : null
}
