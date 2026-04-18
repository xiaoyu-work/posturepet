import { describe, expect, it } from 'vitest'

import { PetRenderer } from './renderer'
import type { PostureSnapshot } from '../posture/types'

const snapshot = (partial: Partial<PostureSnapshot> = {}): PostureSnapshot => ({
  t: 0,
  deviationDeg: 0,
  calibrated: true,
  state: 'healthy',
  ...partial,
})

describe('PetRenderer', () => {
  it('signature advances when the animation step advances', () => {
    const renderer = new PetRenderer(288, 100)
    const a = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
      now: 1000,
    })
    const b = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
      now: 99_999,
    })
    expect(a.signature).not.toBe(b.signature)
  })

  it('signature is identical within the same 150 ms animation step', () => {
    const renderer = new PetRenderer(288, 100)
    // 0 and 149 are both in animation step 0 (ANIM_STEP_MS = 150).
    const a = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
      now: 0,
    })
    const b = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
      now: 149,
    })
    expect(a.signature).toBe(b.signature)
  })

  it('signature reflects posture state changes', () => {
    const renderer = new PetRenderer(288, 100)
    const healthy = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
    })
    const sick = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'sick' }),
    })
    expect(healthy.signature).not.toEqual(sick.signature)
    expect(healthy.vitals.hp).toBeGreaterThan(sick.vitals.hp)
  })

  it('pushes vitals through to the frame', () => {
    const renderer = new PetRenderer(288, 100)
    const frame = renderer.render({
      petType: 'turtle',
      visible: true,
      posture: snapshot({ state: 'alert' }),
    })
    expect(frame.vitals.label).toBe('Slouching')
  })

  it('encodes the whole scene as a Uint8Array of PNG bytes', () => {
    const renderer = new PetRenderer(288, 100)
    const frame = renderer.render({
      petType: 'jellyfish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
    })
    const bytes = frame.imageBytes()
    expect(bytes).toBeInstanceOf(Uint8Array)
  })
})
