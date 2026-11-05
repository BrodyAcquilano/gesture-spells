import { HAND_CONNECTIONS } from './landmarks.js'

// Draws a hand skeleton. `toCanvas([x, y])` maps a landmark to canvas pixels
// (the callers mirror x so the drawing matches the mirrored camera).
export function drawHand(ctx, points, toCanvas, color = 'rgba(0, 240, 255, 0.75)') {
  const canvasPoints = points.map(toCanvas)
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(...canvasPoints[a])
    ctx.lineTo(...canvasPoints[b])
  }
  ctx.stroke()
  ctx.fillStyle = '#ff2bd6'
  for (const [x, y] of canvasPoints) {
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// The usual mapping for a w × h canvas showing the mirrored camera.
export function mirroredMapper(w, h) {
  return ([x, y]) => [(1 - x) * w, y * h]
}
