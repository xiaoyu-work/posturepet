import { describe, expect, it } from 'vitest'

import { MOVEMENT, getPosition, PetRenderer } from './renderer'
import type { PostureSnapshot } from '../posture/types'

const snapshot = (partial: Partial<PostureSnapshot> = {}): PostureSnapshot => ({
  t: 0,
  deviationDeg: 0,
  calibrated: true,
  state: 'healthy',
  ...partial,
})

describe('getPosition', () => {
  it('is deterministic for the same inputs', () => {
    const a = getPosition(1234, 540, 100, MOVEMENT.fish)
    const b = getPosition(1234, 540, 100, MOVEMENT.fish)
    expect(a).toEqual(b)
  })

  it('stays within horizontal margins', () => {
    for (let t = 0; t < 20_000; t += 250) {
      const pose = getPosition(t, 540, 100, MOVEMENT.fish)
      expect(pose.x).toBeGreaterThanOrEqual(44)
      expect(pose.x).toBeLessThanOrEqual(540 - 44)
      expect(pose.y).toBeGreaterThanOrEqual(16)
      expect(pose.y).toBeLessThanOrEqual(100 - 16)
    }
  })

  it('facing is always +/-1', () => {
    const pose = getPosition(500, 540, 100, MOVEMENT.butterfly)
    expect([1, -1]).toContain(pose.facing)
  })
})

describe('PetRenderer', () => {
  it('signature reflects posture state changes', () => {
    const renderer = new PetRenderer(540, 100)
    const healthy = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'healthy' }),
      now: 1000,
    })
    const sick = renderer.render({
      petType: 'fish',
      visible: true,
      posture: snapshot({ state: 'sick' }),
      now: 1000,
    })
    expect(healthy.signature).not.toEqual(sick.signature)
    expect(healthy.vitals.hp).toBeGreaterThan(sick.vitals.hp)
  })

  it('pushes vitals through to the frame', () => {
    const renderer = new PetRenderer(540, 100)
    const frame = renderer.render({
      petType: 'turtle',
      visible: true,
      posture: snapshot({ state: 'alert' }),
      now: 500,
    })
    expect(frame.vitals.label).toBe('Slouching')
  })
})
