import { describe, expect, it } from 'vitest'
import { PostureEstimator } from './estimator'

/** Helper: generate samples at a fixed rate with a callback producing (x,y,z). */
function stream(
  est: PostureEstimator,
  startT: number,
  count: number,
  dtMs: number,
  gen: (i: number) => [number, number, number],
): Array<number | null> {
  const out: Array<number | null> = []
  for (let i = 0; i < count; i++) {
    const [x, y, z] = gen(i)
    out.push(est.push({ t: startT + i * dtMs, x, y, z }))
  }
  return out
}

describe('PostureEstimator', () => {
  it('returns null until calibration window elapses', () => {
    const est = new PostureEstimator({ calibrationMs: 1000 })
    est.onWearOn(0)
    const out = stream(est, 0, 9, 100, () => [0, 0, 1])
    expect(out.every((v) => v === null)).toBe(true)
    expect(est.isCalibrated()).toBe(false)
  })

  it('calibrates after the window and reports ~0° at neutral', () => {
    const est = new PostureEstimator({ calibrationMs: 1000, smoothingTauMs: 1 })
    est.onWearOn(0)
    stream(est, 0, 11, 100, () => [0, 0, 1])
    expect(est.isCalibrated()).toBe(true)

    const v = est.push({ t: 1200, x: 0, y: 0, z: 1 })
    expect(v).not.toBeNull()
    expect(v!).toBeLessThan(1)
  })

  it('reports ~90° when gravity swings from z to x', () => {
    const est = new PostureEstimator({ calibrationMs: 1000, smoothingTauMs: 1 })
    est.onWearOn(0)
    stream(est, 0, 11, 100, () => [0, 0, 1])

    const v = est.push({ t: 1200, x: 1, y: 0, z: 0 })
    expect(v).toBeCloseTo(90, 0)
  })

  it('reports ~30° for a plausible low-head tilt (z: 1 → cos30°=0.866, x: sin30°=0.5)', () => {
    const est = new PostureEstimator({ calibrationMs: 1000, smoothingTauMs: 1 })
    est.onWearOn(0)
    stream(est, 0, 11, 100, () => [0, 0, 1])

    const v = est.push({ t: 1200, x: 0.5, y: 0, z: 0.866 })
    expect(v).toBeCloseTo(30, 0)
  })

  it('smoothing suppresses a single-sample spike', () => {
    const est = new PostureEstimator({ calibrationMs: 100, smoothingTauMs: 500 })
    est.onWearOn(0)
    // 6-sample / 100ms calibration at neutral
    stream(est, 0, 6, 20, () => [0, 0, 1])

    // One noisy sample
    const spike = est.push({ t: 200, x: 1, y: 0, z: 0 })
    // Followed by neutral again
    const calm1 = est.push({ t: 300, x: 0, y: 0, z: 1 })
    const calm2 = est.push({ t: 400, x: 0, y: 0, z: 1 })

    expect(spike).not.toBeNull()
    // spike is attenuated — a true 90° would show up; smoothing should cap it
    expect(spike!).toBeLessThan(30)
    expect(calm2!).toBeLessThan(calm1!)
  })

  it('onWearOff clears state and requires recalibration', () => {
    const est = new PostureEstimator({ calibrationMs: 100 })
    est.onWearOn(0)
    stream(est, 0, 6, 20, () => [0, 0, 1])
    expect(est.isCalibrated()).toBe(true)

    est.onWearOff()
    expect(est.isCalibrated()).toBe(false)
    expect(est.push({ t: 500, x: 0, y: 0, z: 1 })).toBeNull()
  })

  it('baseline is axis-agnostic — works even if gravity is on y', () => {
    const est = new PostureEstimator({ calibrationMs: 100, smoothingTauMs: 1 })
    est.onWearOn(0)
    stream(est, 0, 6, 20, () => [0, 1, 0])
    expect(est.isCalibrated()).toBe(true)

    const sameOrientation = est.push({ t: 200, x: 0, y: 1, z: 0 })
    expect(sameOrientation!).toBeLessThan(1)

    const ninety = est.push({ t: 300, x: 1, y: 0, z: 0 })
    expect(ninety!).toBeGreaterThan(85)
    expect(ninety!).toBeLessThanOrEqual(90)
  })
})
