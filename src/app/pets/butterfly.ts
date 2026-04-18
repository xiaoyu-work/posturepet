import type { PetDrawContext } from './common'

export function drawButterfly({ ctx, pose, now }: PetDrawContext): void {
  ctx.save()
  ctx.translate(pose.x, pose.y)
  if (pose.facing === -1) ctx.scale(-1, 1)

  const wingFlap = 0.5 + 0.5 * Math.sin(now / 80)
  const wingScaleY = 0.35 + 0.65 * wingFlap

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.3

  ctx.save()
  ctx.scale(1, wingScaleY)
  ctx.beginPath()
  ctx.ellipse(-9, -6 / wingScaleY, 11, 9, -0.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(9, -6 / wingScaleY, 11, 9, 0.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.scale(1, wingScaleY)
  ctx.beginPath()
  ctx.ellipse(-7, 5 / wingScaleY, 8, 7, 0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(7, 5 / wingScaleY, 8, 7, -0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = '#909090'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(0, 13)
  ctx.stroke()

  ctx.strokeStyle = '#808080'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.quadraticCurveTo(-4, -18, -8, -20)
  ctx.moveTo(0, -12)
  ctx.quadraticCurveTo(4, -18, 8, -20)
  ctx.stroke()

  ctx.fillStyle = '#c0c0c0'
  ctx.beginPath()
  ctx.arc(-8, -20, 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(8, -20, 1.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
