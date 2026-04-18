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
  /** Sustained-slouch threshold after which the pet's HP drops to zero.
   *  Originally 2 minutes to match a "chronic tech-neck" narrative, but
   *  the user wanted a snappier "sit up or lose all your HP" loop — 10 s
   *  is tight enough to actually feel punitive during a debug session. */
  sickDurationMs: 10_000,
} as const

export type PostureInput = {
  t: number
  deviationDeg: number | null
  wearing: boolean
}

export class PostureStateMachine {
  /** Start of the current run of "user is slouching" (alert OR unwell).
   *  Resets to null the moment the user returns to healthy/calibrating/asleep. */
  private slouchSince: number | null = null
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
      this.slouchSince = null
      return 'asleep'
    }
    if (input.deviationDeg === null) {
      this.slouchSince = null
      return 'calibrating'
    }
    const d = input.deviationDeg
    if (d < POSTURE_THRESHOLDS.alertDeg) {
      this.slouchSince = null
      return 'healthy'
    }
    // User is slouching (alert OR unwell); promote to `sick` after the
    // sustained threshold regardless of exact angle within the slouch band.
    this.slouchSince ??= input.t
    if (input.t - this.slouchSince >= POSTURE_THRESHOLDS.sickDurationMs) return 'sick'
    return d >= POSTURE_THRESHOLDS.unwellDeg ? 'unwell' : 'alert'
  }

  getState(): PostureState {
    return this.lastState
  }
}
