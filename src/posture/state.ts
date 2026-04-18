import type { PostureSnapshot, PostureState } from './types'

/**
 * Posture state machine.
 *
 * Rules (time-hysteresis on top of angle thresholds to avoid chattering):
 *   - deviation < 15°            → healthy
 *   - 15° ≤ deviation < 30°      → alert
 *   - 30° ≤ deviation            → unwell
 *   - unwell sustained > 120 s   → sick
 *   - not wearing                → asleep
 *   - waiting for baseline       → calibrating
 *
 * Thresholds were chosen to be conservative relative to the Phase-0 noise floor
 * (σ ≈ 0.2 g ~ 12°) so that "healthy" truly means "not slouching". They'll be
 * tuned with real pose-test CSV in Phase 2.
 */

export const POSTURE_THRESHOLDS = {
  alertDeg: 15,
  unwellDeg: 30,
  sickDurationMs: 120_000,
} as const

export type PostureInput = {
  t: number
  deviationDeg: number | null
  wearing: boolean
}

export class PostureStateMachine {
  private unwellSince: number | null = null
  private lastState: PostureState = 'calibrating'

  step(input: PostureInput): PostureSnapshot {
    const state = this.classify(input)
    this.lastState = state
    return {
      t: input.t,
      deviationDeg: input.deviationDeg ?? 0,
      calibrated: input.deviationDeg !== null,
      state,
    }
  }

  private classify(input: PostureInput): PostureState {
    if (!input.wearing) {
      this.unwellSince = null
      return 'asleep'
    }
    if (input.deviationDeg === null) {
      this.unwellSince = null
      return 'calibrating'
    }
    const d = input.deviationDeg
    if (d >= POSTURE_THRESHOLDS.unwellDeg) {
      this.unwellSince ??= input.t
      if (input.t - this.unwellSince >= POSTURE_THRESHOLDS.sickDurationMs) return 'sick'
      return 'unwell'
    }
    this.unwellSince = null
    if (d >= POSTURE_THRESHOLDS.alertDeg) return 'alert'
    return 'healthy'
  }

  getState(): PostureState {
    return this.lastState
  }
}
