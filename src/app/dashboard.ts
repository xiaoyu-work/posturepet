import type { PostureState } from '../posture/types'

/**
 * Persistent minute-granularity log of posture snapshots + derived daily stats
 * for the browser dashboard.
 *
 * We sample at most once per minute (not per frame) so the long-run storage
 * cost is bounded — ~1440 rows/day worst case, and we prune rows older than
 * 30 days on every write. No analytics infrastructure, no cloud sync.
 */

const STORAGE_KEY = 'evenpet:posture-log'
export const MAX_LOG_DAYS = 30
export const DASHBOARD_DAYS = 7

export interface MinuteSample {
  /** Epoch ms of the sample */
  ts: number
  /** Neutral deviation in degrees at sample time */
  pitch: number
  /** Posture state at sample time */
  state: PostureState
  /** Whether glasses were being worn */
  wearing: boolean
}

export interface DailyStat {
  /** YYYY-MM-DD */
  day: string
  totalMinutes: number
  healthyMinutes: number
  slouchMinutes: number
  sickMinutes: number
  longestHealthyStreak: number
}

function readLog(): MinuteSample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is MinuteSample => {
      if (!s || typeof s !== 'object') return false
      const c = s as Record<string, unknown>
      return (
        typeof c.ts === 'number' &&
        typeof c.pitch === 'number' &&
        typeof c.state === 'string' &&
        typeof c.wearing === 'boolean'
      )
    })
  } catch {
    return []
  }
}

function writeLog(samples: MinuteSample[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
  } catch {
    /* quota or private mode: lose the write silently, not worth crashing. */
  }
}

export function appendSample(sample: MinuteSample, now: number = Date.now()): void {
  const cutoff = now - MAX_LOG_DAYS * 24 * 60 * 60 * 1000
  const pruned = readLog().filter((s) => s.ts >= cutoff)
  pruned.push(sample)
  writeLog(pruned)
}

export function loadLog(): MinuteSample[] {
  return readLog()
}

export function clearLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** YYYY-MM-DD in the user's local timezone. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function aggregateDaily(samples: MinuteSample[]): DailyStat[] {
  const byDay = new Map<string, MinuteSample[]>()
  for (const s of samples) {
    const k = dayKey(s.ts)
    const list = byDay.get(k) ?? []
    list.push(s)
    byDay.set(k, list)
  }

  const out: DailyStat[] = []
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.ts - b.ts)
    let healthy = 0
    let slouch = 0
    let sick = 0
    let longestStreak = 0
    let currentStreak = 0

    for (const s of list) {
      if (!s.wearing) {
        currentStreak = 0
        continue
      }
      if (s.state === 'healthy') {
        healthy++
        currentStreak++
        longestStreak = Math.max(longestStreak, currentStreak)
      } else if (s.state === 'alert' || s.state === 'unwell') {
        slouch++
        currentStreak = 0
      } else if (s.state === 'sick') {
        sick++
        currentStreak = 0
      } else {
        currentStreak = 0
      }
    }

    out.push({
      day,
      totalMinutes: list.length,
      healthyMinutes: healthy,
      slouchMinutes: slouch,
      sickMinutes: sick,
      longestHealthyStreak: longestStreak,
    })
  }
  out.sort((a, b) => (a.day < b.day ? -1 : 1))
  return out
}

export function lastNDays(stats: DailyStat[], n: number, now: number = Date.now()): DailyStat[] {
  const out: DailyStat[] = []
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 24 * 60 * 60 * 1000)
    const key = dayKey(d.getTime())
    const stat = stats.find((s) => s.day === key) ?? {
      day: key,
      totalMinutes: 0,
      healthyMinutes: 0,
      slouchMinutes: 0,
      sickMinutes: 0,
      longestHealthyStreak: 0,
    }
    out.push(stat)
  }
  return out
}

export function todayStat(now: number = Date.now()): DailyStat {
  const stats = aggregateDaily(readLog())
  const key = dayKey(now)
  return (
    stats.find((s) => s.day === key) ?? {
      day: key,
      totalMinutes: 0,
      healthyMinutes: 0,
      slouchMinutes: 0,
      sickMinutes: 0,
      longestHealthyStreak: 0,
    }
  )
}

/**
 * Sampler that collapses arbitrarily-frequent updates into at most one row per
 * minute of wall-clock time, appending to storage as it goes.
 */
export class MinuteSampler {
  private lastMinute: number | null = null

  constructor(private readonly persist: (s: MinuteSample) => void = appendSample) {}

  tick(sample: MinuteSample): boolean {
    const minute = Math.floor(sample.ts / 60_000)
    if (this.lastMinute === minute) return false
    this.lastMinute = minute
    this.persist(sample)
    return true
  }
}
