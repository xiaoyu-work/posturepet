import { describe, expect, it } from 'vitest'

import { vitalsFor } from './mood'
import type { PostureSnapshot, PostureState } from './types'

function snap(state: PostureState, slouchMs = 0): PostureSnapshot {
  return { t: 0, deviationDeg: 0, calibrated: state !== 'calibrating', state, slouchMs }
}

describe('vitalsFor', () => {
  it('keeps HP full while healthy, asleep, or calibrating', () => {
    expect(vitalsFor(snap('healthy')).hp).toBe(100)
    expect(vitalsFor(snap('asleep')).hp).toBe(100)
    expect(vitalsFor(snap('calibrating')).hp).toBe(100)
  })

  it('drains HP linearly over 10 s of slouching', () => {
    expect(vitalsFor(snap('alert', 0)).hp).toBe(100)
    expect(vitalsFor(snap('alert', 1_000)).hp).toBe(90)
    expect(vitalsFor(snap('alert', 5_000)).hp).toBe(50)
    expect(vitalsFor(snap('alert', 10_000)).hp).toBe(0)
  })

  it('unwell drains on the same clock as alert', () => {
    expect(vitalsFor(snap('unwell', 3_000)).hp).toBe(70)
  })

  it('sick pins HP to zero regardless of slouchMs', () => {
    expect(vitalsFor(snap('sick', 0)).hp).toBe(0)
    expect(vitalsFor(snap('sick', 99_999)).hp).toBe(0)
  })

  it('produces a label + emoji for each state', () => {
    for (const s of ['healthy', 'alert', 'unwell', 'sick', 'asleep', 'calibrating'] as PostureState[]) {
      const v = vitalsFor(snap(s))
      expect(v.label).toBeTruthy()
      expect(v.emoji).toBeTruthy()
    }
  })
})
