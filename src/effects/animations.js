// The animations drawn by code. Each `create` returns one playing instance:
//   { update(dt), draw(ctx), done }
// `anchor` says where on the hand it appears (see anchorPoint in landmarks.js).
// `follow: true` means it keeps moving with that point while it plays (the
// instance then has setPosition(x, y)).
import { createCoins } from './coins.js'
import { createIllumination } from './illumination.js'
import { createFireball } from './fireball.js'
import { createClock } from './clock.js'

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
    create: (x, y, height) => createIllumination(x, y, height),
  },
  fireball: {
    anchor: 'palm',
    create: (x, y, height, width) => createFireball(x, y, height, width),
  },
  clock: {
    anchor: 'middleTip',
    follow: true,
    create: (x, y, height) => createClock(x, y, height),
  },
}

// Where an animation appears on the hand. Files appear at the pinch point.
export function anchorOf(animation) {
  return PROCEDURAL_ANIMATIONS[animation?.procedural]?.anchor ?? 'pinch'
}
