import type { PetDrawContext } from './common'

export function drawJellyfish({ ctx, pose, now }: PetDrawContext): void {
  ctx.save()
  ctx.translate(pose.x, pose.y)
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5

  ctx.beginPath()
  ctx.arc(0, 0, 14, Math.PI, 0)
  for (let a = 0; a <= Math.PI; a += 0.15) {
    const px = 14 * Math.cos(a)
    const py = 3 + Math.sin(a * 4 + now / 300) * 1.8
    ctx.lineTo(-px, py)
  }
  ctx.closePath()
  ctx.stroke()

  for (let i = 0; i < 5; i++) {
    const tx = -8 + i * 4
    const phase = now / 400 + i * 0.9
    ctx.beginPath()
    ctx.moveTo(tx, 5)
    ctx.quadraticCurveTo(tx + Math.sin(phase) * 5, 16, tx + Math.sin(phase + 1) * 4, 28)
    ctx.stroke()
  }

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(-4, -3, 1.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(4, -3, 1.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
