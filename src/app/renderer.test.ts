import { describe, expect, it } from 'vitest'

import { MOVEMENT, getPosition } from './renderer'

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
