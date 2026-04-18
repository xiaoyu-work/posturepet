import type { PetVitals } from '../posture/mood'

/**
 * Pixel-art HP and mood bars drawn into the G2 scene.
 *
 * Both bars live in a 4-px tall strip anchored near the top of the 540×100
 * scene so the pet itself keeps most of the vertical real estate. Each "pixel"
 * is 2 device-pixels, giving the bars a chunky retro look that survives the
 * G2's greyscale rendering without relying on color.
 */

export const OVERLAY_CELL = 2
export const OVERLAY_BAR_WIDTH_CELLS = 40
export const OVERLAY_BAR_HEIGHT_CELLS = 3

const OVERLAY_TOP = 4
const OVERLAY_LEFT = 6
const OVERLAY_GAP = 10
const LABEL_FILL = '#c0c0c0'
const BAR_FILL = '#e0e0e0'
const BAR_FRAME = '#808080'
const BAR_EMPTY = '#303030'

export interface OverlayInput {
  vitals: PetVitals
  deviationDeg: number
  calibrated: boolean
}

export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  const barWidth = OVERLAY_BAR_WIDTH_CELLS * OVERLAY_CELL
  const barHeight = OVERLAY_BAR_HEIGHT_CELLS * OVERLAY_CELL

  drawLabel(ctx, OVERLAY_LEFT, OVERLAY_TOP, 'HP')
  drawBar(ctx, OVERLAY_LEFT + 14, OVERLAY_TOP - 1, barWidth, barHeight, input.vitals.hp / 100)

  const moodRow = OVERLAY_TOP + barHeight + OVERLAY_GAP
  drawLabel(ctx, OVERLAY_LEFT, moodRow, 'MD')
  drawBar(ctx, OVERLAY_LEFT + 14, moodRow - 1, barWidth, barHeight, input.vitals.mood / 100)

  drawLabel(
    ctx,
    OVERLAY_LEFT + 14 + barWidth + 8,
    OVERLAY_TOP,
    input.calibrated ? `${Math.round(input.deviationDeg)}°` : 'CAL',
  )
  drawLabel(ctx, OVERLAY_LEFT + 14 + barWidth + 8, moodRow, input.vitals.label.toUpperCase())
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

/**
 * Tiny pixel font (3×5 glyphs) — just enough to render HP/MD labels and a
 * degree readout. Embedded here rather than pulled from a file because the
 * set of needed glyphs is small and it keeps the renderer zero-dep.
 */
const GLYPHS: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  M: ['101', '111', '111', '101', '101'],
  D: ['110', '101', '101', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  A: ['010', '101', '111', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  Y: ['101', '101', '010', '010', '010'],
  S: ['011', '100', '010', '001', '110'],
  I: ['111', '010', '010', '010', '111'],
  E: ['111', '100', '110', '100', '111'],
  K: ['101', '110', '100', '110', '101'],
  G: ['011', '100', '101', '101', '011'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  R: ['110', '101', '110', '101', '101'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  F: ['111', '100', '110', '100', '100'],
  B: ['110', '101', '110', '101', '110'],
  W: ['101', '101', '111', '111', '101'],
  '!': ['010', '010', '010', '000', '010'],
  '?': ['110', '001', '010', '000', '010'],
  ' ': ['000', '000', '000', '000', '000'],
  '0': ['010', '101', '101', '101', '010'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '110', '101', '010'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['010', '101', '010', '101', '010'],
  '9': ['010', '101', '011', '001', '110'],
  '°': ['010', '101', '010', '000', '000'],
  '…': ['000', '000', '000', '101', '010'],
}

const GLYPH_W = 3
const GLYPH_H = 5
const GLYPH_CELL = 1

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
): void {
  const cell = GLYPH_CELL
  let cursor = x
  for (const ch of text) {
    const rows = GLYPHS[ch]
    if (!rows) {
      cursor += (GLYPH_W + 1) * cell
      continue
    }
    ctx.fillStyle = LABEL_FILL
    for (let row = 0; row < GLYPH_H; row++) {
      const bits = rows[row]
      for (let col = 0; col < GLYPH_W; col++) {
        if (bits[col] === '1') {
          ctx.fillRect(cursor + col * cell, y + row * cell, cell, cell)
        }
      }
    }
    cursor += (GLYPH_W + 1) * cell
  }
}
