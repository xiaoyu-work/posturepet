import type { PostureSnapshot, PostureState } from './types'

/**
 * Posture state machine.
 *
 * Rules:
 *   - deviation < 15°            → healthy
 *   - 15° ≤ deviation < 30°      → alert (mild slouch)
 *   - 30° ≤ deviation            → unwell (strong slouch)
 *   - any slouch (alert OR unwell) sustained ≥ 10 s → sick
 *   - not wearing                → asleep
 *   - waiting for baseline       → calibrating
 *
 * `slouchSince` is the start ms of the current uninterrupted slouch run.
 * We expose the derived `slouchMs` on the snapshot so downstream code
 * (HP-bar drain, toast trigger, etc.) doesn't have to recompute it.
 */

export const POSTURE_THRESHOLDS = {
  alertDeg: 15,
  unwellDeg: 30,
  sickDurationMs: 10_000,
} as const

export type PostureInput = {
  t: number
  deviationDeg: number | null
  wearing: boolean
}

export class PostureStateMachine {
  private slouchSince: number | null = null
  private lastState: PostureState = 'calibrating'

  step(input: PostureInput): PostureSnapshot {
    this.updateSlouchTimer(input)
    const slouchMs =
      this.slouchSince === null ? 0 : Math.max(0, input.t - this.slouchSince)
    const state = this.deriveState(input, slouchMs)
    this.lastState = state
    return {
      t: input.t,
      deviationDeg: input.deviationDeg ?? 0,
      calibrated: input.deviationDeg !== null,
      state,
      slouchMs,
    }
  }

  private updateSlouchTimer(input: PostureInput): void {
    if (!input.wearing || input.deviationDeg === null) {
      this.slouchSince = null
      return
    }
    if (input.deviationDeg < POSTURE_THRESHOLDS.alertDeg) {
      this.slouchSince = null
      return
    }
    this.slouchSince ??= input.t
  }

  private deriveState(input: PostureInput, slouchMs: number): PostureState {
    if (!input.wearing) return 'asleep'
    if (input.deviationDeg === null) return 'calibrating'
    const d = input.deviationDeg
    if (d < POSTURE_THRESHOLDS.alertDeg) return 'healthy'
    if (slouchMs >= POSTURE_THRESHOLDS.sickDurationMs) return 'sick'
    return d >= POSTURE_THRESHOLDS.unwellDeg ? 'unwell' : 'alert'
  }

  getState(): PostureState {
    return this.lastState
  }
}
