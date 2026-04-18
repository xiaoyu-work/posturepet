import type { PostureSnapshot, PostureState } from './types'

/**
 * Maps a posture snapshot → the pet's vital-display values.
 *
 * HP is continuous, not a step function: while the user is slouching we
 * drain it linearly toward 0 over `SICK_MS` milliseconds (so at the 10 s
 * sick threshold HP hits exactly 0). When the user straightens back up,
 * HP snaps back to full — the point of the bar is to reflect "how bad is
 * right now", not a running health pool to preserve across sessions.
 *
 * `asleep` / `calibrating` preserve full HP — taking the glasses off or
 * waiting for a baseline shouldn't be treated as good *or* bad posture.
 */

export type PetVitals = {
  hp: number
  mood: number
  label: string
  emoji: string
}

const SICK_MS = 10_000

const LABEL_BY_STATE: Record<PostureState, { label: string; emoji: string }> = {
  healthy: { label: 'Happy', emoji: '(^_^)' },
  alert: { label: 'Slouching', emoji: '(._.)' },
  unwell: { label: 'Uncomfortable', emoji: '(>_<)' },
  sick: { label: 'Sick!', emoji: '(x_x)' },
  asleep: { label: 'Sleeping', emoji: '(-_-) z' },
  calibrating: { label: 'Calibrating…', emoji: '(o_o)' },
}

export function vitalsFor(snapshot: PostureSnapshot): PetVitals {
  const info = LABEL_BY_STATE[snapshot.state]
  const hp = computeHp(snapshot)
  return {
    hp,
    mood: hp,
    label: info.label,
    emoji: info.emoji,
  }
}

function computeHp(snapshot: PostureSnapshot): number {
  switch (snapshot.state) {
    case 'asleep':
    case 'calibrating':
    case 'healthy':
      return 100
    case 'sick':
      return 0
    case 'alert':
    case 'unwell': {
      const drained = (snapshot.slouchMs / SICK_MS) * 100
      return Math.max(0, Math.min(100, 100 - drained))
    }
  }
}
