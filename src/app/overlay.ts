import type { PetVitals } from '../posture/mood'

/**
 * Pixel-art HP and mood bars drawn into the G2 scene.
 *
 * Two thin bars anchored at the top of the 540×100 scene. Intentionally kept
 * to solid rectangles only — no embedded pixel font, no per-frame labels —
 * because:
 *
 *   1. The G2's monochrome green LED rasterizes 3-px-tall glyphs into an
 *      illegible blur at arm's-length viewing distance.
 *   2. Each extra lit pixel bloats the PNG, and BLE throughput to the glasses
 *      can't absorb much: we saw `sendfailed` on pet-2 the moment the overlay
 *      carried dense text.
 *
 * The browser preview surfaces the same values as text, so there's no loss of
 * information — just cleaner visuals on the lens.
 */

export const OVERLAY_CELL = 2
export const OVERLAY_BAR_WIDTH_CELLS = 40
export const OVERLAY_BAR_HEIGHT_CELLS = 3

const OVERLAY_TOP = 6
const OVERLAY_LEFT = 10
const OVERLAY_GAP = 4

const BAR_FILL = '#e0e0e0'
const BAR_FRAME = '#808080'
const BAR_EMPTY = '#1a1a1a'
const TICK_FILL = '#b0b0b0'

export interface OverlayInput {
  vitals: PetVitals
  deviationDeg: number
  calibrated: boolean
}

export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  const barWidth = OVERLAY_BAR_WIDTH_CELLS * OVERLAY_CELL
  const barHeight = OVERLAY_BAR_HEIGHT_CELLS * OVERLAY_CELL

  // Left tick mark = HP row identifier (1 filled cell, 3 lines of text in disguise)
  drawTick(ctx, OVERLAY_LEFT - 4, OVERLAY_TOP, 'hp')
  drawBar(ctx, OVERLAY_LEFT, OVERLAY_TOP, barWidth, barHeight, input.vitals.hp / 100)

  const moodRow = OVERLAY_TOP + barHeight + OVERLAY_GAP
  drawTick(ctx, OVERLAY_LEFT - 4, moodRow, 'md')
  drawBar(ctx, OVERLAY_LEFT, moodRow, barWidth, barHeight, input.vitals.mood / 100)

  // Calibration indicator: blinking dot to the right of the bars.
  if (!input.calibrated) {
    const blink = Math.floor(Date.now() / 500) % 2 === 0
    if (blink) {
      ctx.fillStyle = TICK_FILL
      ctx.fillRect(OVERLAY_LEFT + barWidth + 6, OVERLAY_TOP + 1, 4, 4)
      ctx.fillRect(OVERLAY_LEFT + barWidth + 6, moodRow + 1, 4, 4)
    }
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillRatio: number,
): void {
  const ratio = Math.max(0, Math.min(1, fillRatio))
  const filledCells = Math.round(OVERLAY_BAR_WIDTH_CELLS * ratio)
  const filledWidth = filledCells * OVERLAY_CELL

  ctx.fillStyle = BAR_EMPTY
  ctx.fillRect(x, y, width, height)

  if (filledWidth > 0) {
    ctx.fillStyle = BAR_FILL
    ctx.fillRect(x, y, filledWidth, height)
  }

  ctx.strokeStyle = BAR_FRAME
  ctx.lineWidth = 1
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1)
}

/** HP / MD marker — one filled pixel for HP, two for MD. Cheap, identifiable. */
function drawTick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: 'hp' | 'md',
): void {
  ctx.fillStyle = TICK_FILL
  if (kind === 'hp') {
    ctx.fillRect(x, y + 1, 2, 4)
  } else {
    ctx.fillRect(x, y + 1, 2, 4)
    ctx.fillRect(x + 3, y + 1, 2, 4)
  }
}
