import type { ImuSample } from './types'

/**
 * Posture estimator — converts raw IMU samples into a head-tilt deviation angle.
 *
 * Algorithm:
 *   1. After `onWearOn()` we collect samples for `calibrationMs` and average
 *      them to produce the neutral gravity direction `v0`.
 *   2. For each new sample v, we compute a smoothed gravity vector v̄ using
 *      exponential moving average (τ ≈ 0.5 s suppresses walking jitter while
 *      staying responsive to deliberate head tilt).
 *   3. The output deviation is `acos(v̄ · v0̂ / |v̄|)` in degrees, which is
 *      0° when the head matches the neutral pose and grows as the user tips
 *      forward / backward / sideways by any amount.
 *
 * Notes:
 *   - The estimator is axis-agnostic by construction: whatever mounting Even
 *     Realities chose for the IMU, the neutral vector captures it.
 *   - During a walk the gravity vector's length swings away from 1 g due to
 *     linear acceleration; we use |v̄| rather than a fixed 1 g so the angle
 *     calculation stays well-conditioned.
 *   - We intentionally do NOT try to decompose pitch vs roll here — total
 *     deviation from neutral is what "slouching pet" needs.
 */
export class PostureEstimator {
  private readonly calibrationMs: number
  private readonly smoothingTauMs: number

  private calibrating = false
  private calibrationStart = 0
  private calibrationSum = { x: 0, y: 0, z: 0 }
  private calibrationCount = 0

  private neutral: { x: number; y: number; z: number } | null = null
  private smoothed: { x: number; y: number; z: number } | null = null
  private lastT: number | null = null

  constructor(opts: { calibrationMs?: number; smoothingTauMs?: number } = {}) {
    this.calibrationMs = opts.calibrationMs ?? 10_000
    this.smoothingTauMs = opts.smoothingTauMs ?? 500
  }

  /** Call when `isWearing` transitions to true (or on first mount). Discards any prior baseline. */
  onWearOn(nowMs: number): void {
    this.calibrating = true
    this.calibrationStart = nowMs
    this.calibrationSum = { x: 0, y: 0, z: 0 }
    this.calibrationCount = 0
    this.neutral = null
    this.smoothed = null
    this.lastT = null
  }

  /** Call when the user takes the glasses off so we can re-baseline on next wear-on. */
  onWearOff(): void {
    this.calibrating = false
    this.neutral = null
    this.smoothed = null
    this.lastT = null
  }

  isCalibrated(): boolean {
    return this.neutral !== null
  }

  /**
   * Ingest one sample.
   * @returns deviation from neutral in degrees, or null if not yet calibrated.
   */
  push(sample: ImuSample): number | null {
    if (this.calibrating) {
      this.calibrationSum.x += sample.x
      this.calibrationSum.y += sample.y
      this.calibrationSum.z += sample.z
      this.calibrationCount += 1
      if (sample.t - this.calibrationStart >= this.calibrationMs && this.calibrationCount >= 5) {
        const n = this.calibrationCount
        this.neutral = {
          x: this.calibrationSum.x / n,
          y: this.calibrationSum.y / n,
          z: this.calibrationSum.z / n,
        }
        this.calibrating = false
        this.smoothed = { ...this.neutral }
        this.lastT = sample.t
      }
      return null
    }

    if (!this.neutral) return null

    if (this.smoothed === null || this.lastT === null) {
      this.smoothed = { x: sample.x, y: sample.y, z: sample.z }
      this.lastT = sample.t
    } else {
      const dt = Math.max(1, sample.t - this.lastT)
      const alpha = dt / (this.smoothingTauMs + dt)
      this.smoothed.x += alpha * (sample.x - this.smoothed.x)
      this.smoothed.y += alpha * (sample.y - this.smoothed.y)
      this.smoothed.z += alpha * (sample.z - this.smoothed.z)
      this.lastT = sample.t
    }

    return angleBetweenDeg(this.smoothed, this.neutral)
  }
}

function angleBetweenDeg(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z
  const magA = Math.hypot(a.x, a.y, a.z)
  const magB = Math.hypot(b.x, b.y, b.z)
  if (magA < 1e-6 || magB < 1e-6) return 0
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)))
  return (Math.acos(cos) * 180) / Math.PI
}
