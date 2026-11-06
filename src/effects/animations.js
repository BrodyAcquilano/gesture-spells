// The animations drawn by code. Each `create` returns one playing instance:
//   { update(dt), draw(ctx), done }
// `anchor` says where on the hand it appears by default (see anchorPoint in
// landmarks.js) and `follow: true` that it keeps moving with that point by
// default; both can be changed in the Animations tab (placementOf below).
// `canFollow` says whether it can follow at all (its instance has
// setPosition(x, y)); ones that burst out from where they're cast can't.
import { createCoins } from './coins.js'
import { createIllumination } from './illumination.js'
import { createFireball } from './fireball.js'
import { createClock } from './clock.js'
import { createSprout } from './sprout.js'
import { cleanPlacement } from '../library/placement.js'

export const PROCEDURAL_ANIMATIONS = {
  coins: {
    anchor: 'pinch',
    create(x, y, height) {
      const coins = createCoins()
      coins.burst(x, y, undefined, height / 720)
      return {
        update: (dt) => coins.update(dt),
        draw: (ctx) => coins.draw(ctx),
        get done() {
          return coins.count === 0
        },
      }
    },
  },
  illumination: {
    anchor: 'indexTip',
    follow: true,
    canFollow: true,
    create: (x, y, height) => createIllumination(x, y, height),
  },
  fireball: {
    anchor: 'palm',
    create: (x, y, height, width) => createFireball(x, y, height, width),
  },
  clock: {
    anchor: 'middleTip',
    follow: true,
    canFollow: true,
    create: (x, y, height) => createClock(x, y, height),
  },
  sprout: {
    anchor: 'indexTip',
    follow: true,
    canFollow: true, // grows out of the tip of its finger, along it (setFinger)
    create: (x, y, height) => createSprout(x, y, height),
  },
}

// Where and how an animation appears on the hand: the placement saved with
// it (src/library/placement.js), filled in with the defaults of one drawn by
// code. One that can't follow never does.
export function placementOf(animation) {
  const code = PROCEDURAL_ANIMATIONS[animation?.procedural]
  if (!code) return cleanPlacement(animation?.placement)
  const placement = cleanPlacement(animation.placement, { anchor: code.anchor, follow: Boolean(code.follow) })
  return { ...placement, follow: Boolean(code.canFollow) && placement.follow }
}

export function anchorOf(animation) {
  return placementOf(animation).anchor
}
