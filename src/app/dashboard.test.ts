import { beforeEach, describe, expect, it } from 'vitest'

import {
  aggregateDaily,
  appendSample,
  clearLog,
  dayKey,
  lastNDays,
  loadLog,
  MinuteSampler,
  type MinuteSample,
} from './dashboard'

beforeEach(() => {
  localStorage.clear()
})

describe('dayKey', () => {
  it('produces YYYY-MM-DD', () => {
    const ts = new Date(2026, 3, 18, 14, 30).getTime()
    expect(dayKey(ts)).toBe('2026-04-18')
  })
})

describe('appendSample + loadLog', () => {
  it('round-trips through storage', () => {
    const s: MinuteSample = { ts: 1_000, pitch: 5, state: 'healthy', wearing: true }
    appendSample(s)
    expect(loadLog()).toEqual([s])
  })

  it('prunes samples older than 30 days', () => {
    const now = Date.now()
    const old = now - 31 * 24 * 60 * 60 * 1000
    appendSample({ ts: old, pitch: 0, state: 'healthy', wearing: true }, now)
    appendSample({ ts: now, pitch: 10, state: 'alert', wearing: true }, now)
    const log = loadLog()
    expect(log).toHaveLength(1)
    expect(log[0].state).toBe('alert')
  })
})

describe('aggregateDaily', () => {
  it('counts minutes by state and tracks longest healthy streak', () => {
    const base = new Date(2026, 3, 18, 9, 0).getTime()
    const samples: MinuteSample[] = [
      { ts: base + 0 * 60_000, pitch: 5, state: 'healthy', wearing: true },
      { ts: base + 1 * 60_000, pitch: 5, state: 'healthy', wearing: true },
      { ts: base + 2 * 60_000, pitch: 18, state: 'alert', wearing: true },
      { ts: base + 3 * 60_000, pitch: 35, state: 'unwell', wearing: true },
      { ts: base + 4 * 60_000, pitch: 6, state: 'healthy', wearing: true },
      { ts: base + 5 * 60_000, pitch: 6, state: 'healthy', wearing: true },
      { ts: base + 6 * 60_000, pitch: 6, state: 'healthy', wearing: true },
      { ts: base + 7 * 60_000, pitch: 40, state: 'sick', wearing: true },
    ]
    const [stat] = aggregateDaily(samples)
    expect(stat.totalMinutes).toBe(8)
    expect(stat.healthyMinutes).toBe(5)
    expect(stat.slouchMinutes).toBe(2)
    expect(stat.sickMinutes).toBe(1)
    expect(stat.longestHealthyStreak).toBe(3)
  })

  it('splits across days', () => {
    const d1 = new Date(2026, 3, 17, 23, 30).getTime()
    const d2 = new Date(2026, 3, 18, 0, 30).getTime()
    const samples: MinuteSample[] = [
      { ts: d1, pitch: 0, state: 'healthy', wearing: true },
      { ts: d2, pitch: 0, state: 'alert', wearing: true },
    ]
    const stats = aggregateDaily(samples)
    expect(stats).toHaveLength(2)
    expect(stats[0].day).toBe('2026-04-17')
    expect(stats[1].day).toBe('2026-04-18')
  })
})

describe('lastNDays', () => {
  it('pads missing days with zeros', () => {
    const now = new Date(2026, 3, 18, 12, 0).getTime()
    const samples: MinuteSample[] = [{ ts: now, pitch: 0, state: 'healthy', wearing: true }]
    const stats = lastNDays(aggregateDaily(samples), 7, now)
    expect(stats).toHaveLength(7)
    expect(stats[6].day).toBe('2026-04-18')
    expect(stats[0].totalMinutes).toBe(0)
    expect(stats[6].healthyMinutes).toBe(1)
  })
})

describe('MinuteSampler', () => {
  it('persists at most one sample per wall-clock minute', () => {
    const captured: MinuteSample[] = []
    const sampler = new MinuteSampler((s) => captured.push(s))
    sampler.tick({ ts: 0, pitch: 0, state: 'healthy', wearing: true })
    sampler.tick({ ts: 10_000, pitch: 0, state: 'healthy', wearing: true })
    sampler.tick({ ts: 59_999, pitch: 0, state: 'healthy', wearing: true })
    sampler.tick({ ts: 60_001, pitch: 0, state: 'alert', wearing: true })
    expect(captured).toHaveLength(2)
    expect(captured[0].state).toBe('healthy')
    expect(captured[1].state).toBe('alert')
  })
})

describe('clearLog', () => {
  it('removes stored samples', () => {
    appendSample({ ts: 1, pitch: 0, state: 'healthy', wearing: true })
    clearLog()
    expect(loadLog()).toEqual([])
  })
})
