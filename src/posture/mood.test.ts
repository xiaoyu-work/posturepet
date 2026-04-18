import { describe, expect, it } from 'vitest'

import { vitalsFor, VITALS_BY_STATE } from './mood'

describe('vitalsFor', () => {
  it('returns matching record for every state', () => {
    for (const state of Object.keys(VITALS_BY_STATE) as Array<keyof typeof VITALS_BY_STATE>) {
      expect(vitalsFor(state)).toBe(VITALS_BY_STATE[state])
    }
  })

  it('has HP/mood on a 0–100 scale', () => {
    for (const v of Object.values(VITALS_BY_STATE)) {
      expect(v.hp).toBeGreaterThanOrEqual(0)
      expect(v.hp).toBeLessThanOrEqual(100)
      expect(v.mood).toBeGreaterThanOrEqual(0)
      expect(v.mood).toBeLessThanOrEqual(100)
    }
  })

  it('sick is the lowest state', () => {
    expect(VITALS_BY_STATE.sick.hp).toBeLessThan(VITALS_BY_STATE.unwell.hp)
    expect(VITALS_BY_STATE.unwell.hp).toBeLessThan(VITALS_BY_STATE.alert.hp)
    expect(VITALS_BY_STATE.alert.hp).toBeLessThan(VITALS_BY_STATE.healthy.hp)
  })

  it('mood degrades faster than HP at the alert stage', () => {
    const a = VITALS_BY_STATE.alert
    expect(100 - a.mood).toBeGreaterThan(100 - a.hp)
  })
})
