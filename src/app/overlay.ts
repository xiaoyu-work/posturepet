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

/** HP is drawn as 10 discrete cells so each cell = 10 % — matches the
 *  10 s / "1 cell per second of slouching" drain rate. Cells have a 1-px
 *  gap between them so the segmentation is legible at lens distance. */
const BAR_SEGMENTS = 10
const BAR_SEGMENT_WIDTH = 5
const BAR_SEGMENT_GAP = 1
const BAR_HEIGHT = 6
const BAR_TOTAL_WIDTH =
  BAR_SEGMENTS * BAR_SEGMENT_WIDTH + (BAR_SEGMENTS - 1) * BAR_SEGMENT_GAP

const LABEL_X = 4
const BAR_X = 20
const VALUE_X = BAR_X + BAR_TOTAL_WIDTH + 4

const ROW_HP_Y = 8

const LABEL_FILL = '#d0d0d0'
const BAR_FILL = '#e8e8e8'
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
  // round(0.5-up) so fractional HP still visibly fills the next cell.
  const filled = Math.round(BAR_SEGMENTS * r)
  for (let i = 0; i < BAR_SEGMENTS; i++) {
    const cellX = x + i * (BAR_SEGMENT_WIDTH + BAR_SEGMENT_GAP)
    ctx.fillStyle = i < filled ? BAR_FILL : BAR_EMPTY
    ctx.fillRect(cellX, y, BAR_SEGMENT_WIDTH, BAR_HEIGHT)
  }
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
