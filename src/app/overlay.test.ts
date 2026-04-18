import { describe, expect, it } from 'vitest'

import { drawOverlay } from './overlay'
import { vitalsFor } from '../posture/mood'

function mkCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = 540
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  return ctx
}

describe('drawOverlay', () => {
  it('does not throw for any posture state', () => {
    const ctx = mkCtx()
    const states = ['healthy', 'alert', 'unwell', 'sick', 'asleep', 'calibrating'] as const
    for (const state of states) {
      expect(() =>
        drawOverlay(ctx, {
          vitals: vitalsFor(state),
          deviationDeg: 12.5,
          calibrated: state !== 'calibrating',
        }),
      ).not.toThrow()
    }
  })

  it('draws pixels for non-empty HP', () => {
    const ctx = mkCtx()
    drawOverlay(ctx, {
      vitals: vitalsFor('healthy'),
      deviationDeg: 0,
      calibrated: true,
    })
    const data = ctx.getImageData(0, 0, 540, 100).data
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10) lit++
    }
    expect(lit).toBeGreaterThan(100)
  })
})
