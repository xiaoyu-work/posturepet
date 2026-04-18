export interface PetPose {
  x: number
  y: number
  facing: 1 | -1
  tilt: number
}

export interface PetDrawContext {
  ctx: CanvasRenderingContext2D
  pose: PetPose
  now: number
}

export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  facing: 1 | -1,
  now: number,
): void {
  const baseX = fx - facing * 20
  ctx.strokeStyle = '#353535'
  ctx.lineWidth = 0.7
  for (let i = 0; i < 3; i++) {
    const phase = (now / 2200 + i * 0.33) % 1
    const bx = baseX + Math.sin(now / 800 + i * 2.5) * 3
    const by = fy - 6 - phase * 28
    const r = 1 + phase * 1.5
    const alpha = (1 - phase) * 0.5
    if (alpha <= 0.02) continue
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
