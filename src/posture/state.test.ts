import { describe, expect, it } from 'vitest'
import { POSTURE_THRESHOLDS, PostureStateMachine } from './state'

describe('PostureStateMachine', () => {
  it('reports calibrating when deviation is unknown', () => {
    const sm = new PostureStateMachine()
    const s = sm.step({ t: 0, deviationDeg: null, wearing: true })
    expect(s.state).toBe('calibrating')
    expect(s.calibrated).toBe(false)
  })

  it('reports asleep when not wearing', () => {
    const sm = new PostureStateMachine()
    expect(sm.step({ t: 0, deviationDeg: 0, wearing: false }).state).toBe('asleep')
    expect(sm.step({ t: 1, deviationDeg: 45, wearing: false }).state).toBe('asleep')
  })

  it('maps angles to healthy / alert / unwell', () => {
    const sm = new PostureStateMachine()
    expect(sm.step({ t: 0, deviationDeg: 5, wearing: true }).state).toBe('healthy')
    expect(sm.step({ t: 1, deviationDeg: 14.9, wearing: true }).state).toBe('healthy')
    expect(sm.step({ t: 2, deviationDeg: 15, wearing: true }).state).toBe('alert')
    expect(sm.step({ t: 3, deviationDeg: 29.9, wearing: true }).state).toBe('alert')
    expect(sm.step({ t: 4, deviationDeg: 30, wearing: true }).state).toBe('unwell')
    expect(sm.step({ t: 5, deviationDeg: 60, wearing: true }).state).toBe('unwell')
  })

  it('transitions to sick only after sustained unwell', () => {
    const sm = new PostureStateMachine()
    const dur = POSTURE_THRESHOLDS.sickDurationMs

    expect(sm.step({ t: 0, deviationDeg: 45, wearing: true }).state).toBe('unwell')
    expect(sm.step({ t: dur - 1, deviationDeg: 45, wearing: true }).state).toBe('unwell')
    expect(sm.step({ t: dur, deviationDeg: 45, wearing: true }).state).toBe('sick')
  })

  it('resets sick timer when posture improves', () => {
    const sm = new PostureStateMachine()
    const dur = POSTURE_THRESHOLDS.sickDurationMs

    sm.step({ t: 0, deviationDeg: 45, wearing: true })
    sm.step({ t: 60_000, deviationDeg: 5, wearing: true })
    // Return to slouching — timer should restart, not continue
    expect(sm.step({ t: 70_000, deviationDeg: 45, wearing: true }).state).toBe('unwell')
    expect(sm.step({ t: 70_000 + dur - 1, deviationDeg: 45, wearing: true }).state).toBe('unwell')
    expect(sm.step({ t: 70_000 + dur, deviationDeg: 45, wearing: true }).state).toBe('sick')
  })

  it('wear-off clears the sick timer', () => {
    const sm = new PostureStateMachine()
    const dur = POSTURE_THRESHOLDS.sickDurationMs

    sm.step({ t: 0, deviationDeg: 45, wearing: true })
    sm.step({ t: 60_000, deviationDeg: 45, wearing: false }) // took them off
    sm.step({ t: 120_000, deviationDeg: 45, wearing: true }) // put them back
    // Need another full window of unwell
    expect(sm.step({ t: 120_000 + dur - 1, deviationDeg: 45, wearing: true }).state).toBe('unwell')
  })
})
