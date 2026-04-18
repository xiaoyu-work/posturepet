import type { PetVitals } from '../posture/mood'

/**
 * Pixel-art HP meter drawn into the G2 scene.
 *
 * We used to render both HP and MP (mood), but the user preferred a single
 * vital to watch. Keeping HP because it reflects the thing we actually care
 * about — how bad the user's posture is. Mood is still tracked internally
 * (vitals object) for future features like the pet's facial expression.
 *
 * Layout (top-left of the 288×100 scene):
 *
 *   HP [████████░░░░] 65
 *
 * Label + bar + right-aligned numeric readout. During calibration the
 * readout shows "---".
 */

const BAR_WIDTH_CELLS = 40
const BAR_CELL = 1
const BAR_HEIGHT = 4

const LABEL_X = 4
const BAR_X = 18
const VALUE_X = BAR_X + BAR_WIDTH_CELLS * BAR_CELL + 4

const ROW_HP_Y = 8

const LABEL_FILL = '#d0d0d0'
const BAR_FILL = '#e8e8e8'
const BAR_FRAME = '#707070'
const BAR_EMPTY = '#1a1a1a'

export interface OverlayInput {
  vitals: PetVitals
  deviationDeg: number
  calibrated: boolean
}

export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  drawRow(ctx, ROW_HP_Y, 'HP', input.vitals.hp, input.calibrated)
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  ratio01to100: number,
  calibrated: boolean,
): void {
  drawLabel(ctx, LABEL_X, y, label)
  drawBar(ctx, BAR_X, y, ratio01to100 / 100)
  const readout = calibrated ? String(Math.round(ratio01to100)).padStart(3, ' ') : '---'
  drawLabel(ctx, VALUE_X, y, readout)
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, ratio: number): void {
  const r = Math.max(0, Math.min(1, ratio))
  const totalWidth = BAR_WIDTH_CELLS * BAR_CELL
  const filled = Math.round(BAR_WIDTH_CELLS * r) * BAR_CELL

  ctx.fillStyle = BAR_EMPTY
  ctx.fillRect(x, y, totalWidth, BAR_HEIGHT)

  if (filled > 0) {
    ctx.fillStyle = BAR_FILL
    ctx.fillRect(x, y, filled, BAR_HEIGHT)
  }

  ctx.strokeStyle = BAR_FRAME
  ctx.lineWidth = 1
  ctx.strokeRect(x - 0.5, y - 0.5, totalWidth + 1, BAR_HEIGHT + 1)
}

// Minimal 3×5 pixel font. Only includes glyphs we actually render.
const GLYPHS: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  M: ['101', '111', '111', '101', '101'],
  '-': ['000', '000', '111', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '110', '101', '010'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['010', '101', '010', '101', '010'],
  '9': ['010', '101', '011', '001', '110'],
}

const GLYPH_W = 3
const GLYPH_H = 5
const GLYPH_CELL = 1

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  const cell = GLYPH_CELL
  let cursor = x
  for (const ch of text) {
    const rows = GLYPHS[ch]
    if (rows) {
      ctx.fillStyle = LABEL_FILL
      for (let row = 0; row < GLYPH_H; row++) {
        const bits = rows[row]
        for (let col = 0; col < GLYPH_W; col++) {
          if (bits[col] === '1') {
            ctx.fillRect(cursor + col * cell, y + row * cell, cell, cell)
          }
        }
      }
    }
    cursor += (GLYPH_W + 1) * cell
  }
}
