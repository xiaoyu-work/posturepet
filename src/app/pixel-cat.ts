import type { PetType } from './types'

interface RenderedFrame {
  canvas: HTMLCanvasElement
  segments: string[]
  step: number
}

const SEGMENT_COUNT = 3

// ─── Shared helpers ───

function getPosition(
  now: number,
  w: number,
  h: number,
  freqs: { fx1: number; fx2: number; fy1: number; fy2: number; ax1: number; ax2: number; ay1: number; ay2: number; px2: number; py1: number; py2: number },
): { x: number; y: number; facing: 1 | -1; tilt: number } {
  const t = now / 1000
  const mx = 44
  const my = 16

  const x = mx + (w - 2 * mx) * (0.5 + freqs.ax1 * Math.sin(t * freqs.fx1) + freqs.ax2 * Math.sin(t * freqs.fx2 + freqs.px2))
  const y = my + (h - 2 * my) * (0.5 + freqs.ay1 * Math.sin(t * freqs.fy1 + freqs.py1) + freqs.ay2 * Math.sin(t * freqs.fy2 + freqs.py2))

  const vx = freqs.ax1 * freqs.fx1 * Math.cos(t * freqs.fx1) + freqs.ax2 * freqs.fx2 * Math.cos(t * freqs.fx2 + freqs.px2)
  const vy = freqs.ay1 * freqs.fy1 * Math.cos(t * freqs.fy1 + freqs.py1) + freqs.ay2 * freqs.fy2 * Math.cos(t * freqs.fy2 + freqs.py2)

  const facing: 1 | -1 = vx >= 0 ? 1 : -1
  const tilt = Math.atan2(vy, Math.abs(vx)) * 0.25
  return { x, y, facing, tilt }
}

const MOVEMENT: Record<PetType, Parameters<typeof getPosition>[3]> = {
  fish:      { fx1: 0.21, fx2: 0.67, fy1: 0.34, fy2: 0.53, ax1: 0.38, ax2: 0.12, ay1: 0.32, ay2: 0.13, px2: 1.5, py1: 0.9, py2: 2.3 },
  jellyfish: { fx1: 0.13, fx2: 0.41, fy1: 0.28, fy2: 0.61, ax1: 0.20, ax2: 0.10, ay1: 0.35, ay2: 0.15, px2: 2.0, py1: 0.5, py2: 1.8 },
  turtle:    { fx1: 0.12, fx2: 0.37, fy1: 0.19, fy2: 0.43, ax1: 0.40, ax2: 0.10, ay1: 0.15, ay2: 0.10, px2: 1.2, py1: 0.7, py2: 2.5 },
  butterfly: { fx1: 0.27, fx2: 0.73, fy1: 0.41, fy2: 0.89, ax1: 0.30, ax2: 0.15, ay1: 0.30, ay2: 0.15, px2: 0.8, py1: 1.2, py2: 2.4 },
}

function drawBubbles(ctx: CanvasRenderingContext2D, fx: number, fy: number, facing: 1 | -1, now: number): void {
  const baseX = fx - facing * 20
  ctx.strokeStyle = '#353535'
  ctx.lineWidth = 0.7
  for (let i = 0; i < 3; i++) {
    const phase = ((now / 2200 + i * 0.33) % 1)
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

// ─── Fish ───

function drawFish(ctx: CanvasRenderingContext2D, cx: number, cy: number, facing: 1 | -1, now: number, tilt: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt * facing)
  if (facing === -1) ctx.scale(-1, 1)

  const bx = 20, by = 8
  const tw = Math.sin(now / 140) * 4

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5

  // Body
  ctx.beginPath()
  ctx.ellipse(0, 0, bx, by, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Tail
  ctx.beginPath()
  ctx.moveTo(-bx + 3, -1)
  ctx.quadraticCurveTo(-bx - 6, -6 + tw, -bx - 12, -9 + tw)
  ctx.moveTo(-bx + 3, 1)
  ctx.quadraticCurveTo(-bx - 6, 6 + tw, -bx - 12, 9 + tw)
  ctx.stroke()

  // Dorsal fin
  ctx.beginPath()
  ctx.moveTo(-1, -by + 1)
  ctx.lineTo(5, -by - 5)
  ctx.lineTo(10, -by + 1)
  ctx.stroke()

  // Pectoral fin
  ctx.beginPath()
  ctx.moveTo(3, by - 2)
  ctx.lineTo(0, by + 3)
  ctx.lineTo(8, by - 1)
  ctx.stroke()

  // Eye
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(bx * 0.42, -by * 0.18, 1.8, 0, Math.PI * 2)
  ctx.fill()

  // Mouth
  ctx.strokeStyle = '#707070'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bx - 1, 1)
  ctx.lineTo(bx + 1, 0)
  ctx.stroke()

  ctx.restore()
}

// ─── Jellyfish ───

function drawJellyfish(ctx: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5

  // Bell (dome)
  ctx.beginPath()
  ctx.arc(0, 0, 14, Math.PI, 0)
  // Wavy skirt
  for (let a = 0; a <= Math.PI; a += 0.15) {
    const px = 14 * Math.cos(a)
    const py = 3 + Math.sin(a * 4 + now / 300) * 1.8
    ctx.lineTo(-px, py)
  }
  ctx.closePath()
  ctx.stroke()

  // Tentacles
  for (let i = 0; i < 5; i++) {
    const tx = -8 + i * 4
    const phase = now / 400 + i * 0.9
    ctx.beginPath()
    ctx.moveTo(tx, 5)
    ctx.quadraticCurveTo(tx + Math.sin(phase) * 5, 16, tx + Math.sin(phase + 1) * 4, 28)
    ctx.stroke()
  }

  // Eyes
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(-4, -3, 1.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(4, -3, 1.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Turtle ───

function drawTurtle(ctx: CanvasRenderingContext2D, cx: number, cy: number, facing: 1 | -1, now: number, tilt: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt * facing)
  if (facing === -1) ctx.scale(-1, 1)

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5
  const flipperAngle = Math.sin(now / 320) * 0.35

  // Shell
  ctx.beginPath()
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Shell pattern
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

  // Head
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(20, -1, 6, 5, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Eye
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(22, -2, 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Flippers
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.3
  const fd = Math.sin(flipperAngle) * 4
  // Front
  ctx.beginPath()
  ctx.moveTo(10, -8)
  ctx.lineTo(16, -14 + fd)
  ctx.moveTo(10, 8)
  ctx.lineTo(16, 14 - fd)
  ctx.stroke()
  // Back
  ctx.beginPath()
  ctx.moveTo(-12, -7)
  ctx.lineTo(-18, -12 + fd)
  ctx.moveTo(-12, 7)
  ctx.lineTo(-18, 12 - fd)
  ctx.stroke()

  // Tail
  ctx.beginPath()
  ctx.moveTo(-16, 0)
  ctx.lineTo(-22, 2 + Math.sin(now / 280) * 2)
  ctx.stroke()

  ctx.restore()
}

// ─── Butterfly ───

function drawButterfly(ctx: CanvasRenderingContext2D, cx: number, cy: number, facing: 1 | -1, now: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  if (facing === -1) ctx.scale(-1, 1)

  const wingFlap = 0.5 + 0.5 * Math.sin(now / 80)
  const wingScaleY = 0.35 + 0.65 * wingFlap

  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.3

  // Upper wings
  ctx.save()
  ctx.scale(1, wingScaleY)
  ctx.beginPath()
  ctx.ellipse(-9, -6 / wingScaleY, 11, 9, -0.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(9, -6 / wingScaleY, 11, 9, 0.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Lower wings
  ctx.save()
  ctx.scale(1, wingScaleY)
  ctx.beginPath()
  ctx.ellipse(-7, 5 / wingScaleY, 8, 7, 0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(7, 5 / wingScaleY, 8, 7, -0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Body
  ctx.strokeStyle = '#909090'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(0, 13)
  ctx.stroke()

  // Antennae
  ctx.strokeStyle = '#808080'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.quadraticCurveTo(-4, -18, -8, -20)
  ctx.moveTo(0, -12)
  ctx.quadraticCurveTo(4, -18, 8, -20)
  ctx.stroke()

  // Antenna tips
  ctx.fillStyle = '#c0c0c0'
  ctx.beginPath()
  ctx.arc(-8, -20, 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(8, -20, 1.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Scene segmentation ───

function sceneToSegments(canvas: HTMLCanvasElement): string[] {
  const sw = Math.floor(canvas.width / SEGMENT_COUNT)
  return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
    const seg = document.createElement('canvas')
    seg.width = sw
    seg.height = canvas.height
    const ctx = seg.getContext('2d')
    if (!ctx) throw new Error('Segment context unavailable.')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, i * sw, 0, sw, canvas.height, 0, 0, sw, canvas.height)
    return seg.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  })
}

// ─── Dispatch drawing by pet type ───

function drawPet(ctx: CanvasRenderingContext2D, petType: PetType, cx: number, cy: number, facing: 1 | -1, now: number, tilt: number): void {
  switch (petType) {
    case 'fish':
      drawFish(ctx, cx, cy, facing, now, tilt)
      break
    case 'jellyfish':
      drawJellyfish(ctx, cx, cy, now)
      break
    case 'turtle':
      drawTurtle(ctx, cx, cy, facing, now, tilt)
      break
    case 'butterfly':
      drawButterfly(ctx, cx, cy, facing, now)
      break
  }
}

function isAquatic(petType: PetType): boolean {
  return petType !== 'butterfly'
}

// ─── Public renderer ───

export class PetRenderer {
  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  render(petType: PetType, visible: boolean, now = Date.now()): RenderedFrame {
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable.')

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.width, this.height)

    if (visible) {
      const pos = getPosition(now, this.width, this.height, MOVEMENT[petType])
      drawPet(ctx, petType, pos.x, pos.y, pos.facing, now, pos.tilt)
      if (isAquatic(petType)) {
        drawBubbles(ctx, pos.x, pos.y, pos.facing, now)
      }
    }

    return {
      canvas,
      segments: sceneToSegments(canvas),
      step: visible ? Math.floor(now / 140) : -1,
    }
  }
}
