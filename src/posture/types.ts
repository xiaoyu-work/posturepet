/**
 * Posture estimation shared types.
 *
 * The glasses expose an accelerometer via the IMU stream. Phase 0 confirmed:
 *   - units are gravity-g (|v| ≈ 1 at rest)
 *   - sampling ~10 Hz at P100
 *   - one axis aligned with gravity depending on head orientation
 *
 * We do NOT hard-code which axis corresponds to pitch. Instead the estimator
 * captures a neutral gravity vector during wear-on and reports the angle
 * between the current gravity vector and the neutral vector — so the design
 * survives any mounting orientation and user head tilt at startup.
 */

export type ImuSample = {
  /** milliseconds, monotonic; usually `performance.now()` */
  t: number
  /** g-units (not m/s²) */
  x: number
  y: number
  z: number
}

export type PostureState = 'healthy' | 'alert' | 'unwell' | 'sick' | 'asleep' | 'calibrating'

export type PostureSnapshot = {
  t: number
  /** degrees of deviation from neutral gravity vector, 0 = perfectly neutral */
  deviationDeg: number
  /** true once baseline is captured */
  calibrated: boolean
  state: PostureState
}
