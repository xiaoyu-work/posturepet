import type { PetDrawContext } from './common'

export function drawTurtle({ ctx, pose, now }: PetDrawContext): void {
  const { x: cx, y: cy, facing, tilt } = pose
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt * facing)
  if (facing === -1) ctx.scale(-1, 1)

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5
  const flipperAngle = Math.sin(now / 320) * 0.35

  ctx.beginPath()
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = '#555555'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.lineTo(8, 0)
  ctx.moveTo(-4, -9)
  ctx.lineTo(-4, 9)
  ctx.moveTo(4, -9)
  ctx.lineTo(4, 9)
  ctx.stroke()

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(20, -1, 6, 5, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(22, -2, 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.3
  const fd = Math.sin(flipperAngle) * 4
  ctx.beginPath()
  ctx.moveTo(10, -8)
  ctx.lineTo(16, -14 + fd)
  ctx.moveTo(10, 8)
  ctx.lineTo(16, 14 - fd)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-12, -7)
  ctx.lineTo(-18, -12 + fd)
  ctx.moveTo(-12, 7)
  ctx.lineTo(-18, 12 - fd)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-16, 0)
  ctx.lineTo(-22, 2 + Math.sin(now / 280) * 2)
  ctx.stroke()

  ctx.restore()
}
