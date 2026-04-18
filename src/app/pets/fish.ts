import type { PetDrawContext } from './common'

export function drawFish({ ctx, pose, now }: PetDrawContext): void {
  const { x: cx, y: cy, facing, tilt } = pose
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt * facing)
  if (facing === -1) ctx.scale(-1, 1)

  const bx = 20
  const by = 8
  const tw = Math.sin(now / 140) * 4

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5

  ctx.beginPath()
  ctx.ellipse(0, 0, bx, by, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-bx + 3, -1)
  ctx.quadraticCurveTo(-bx - 6, -6 + tw, -bx - 12, -9 + tw)
  ctx.moveTo(-bx + 3, 1)
  ctx.quadraticCurveTo(-bx - 6, 6 + tw, -bx - 12, 9 + tw)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-1, -by + 1)
  ctx.lineTo(5, -by - 5)
  ctx.lineTo(10, -by + 1)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(3, by - 2)
  ctx.lineTo(0, by + 3)
  ctx.lineTo(8, by - 1)
  ctx.stroke()

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(bx * 0.42, -by * 0.18, 1.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#707070'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bx - 1, 1)
  ctx.lineTo(bx + 1, 0)
  ctx.stroke()

  ctx.restore()
}
