import type { PostureState } from './types'

/**
 * Maps posture state → pet's vital display values.
 *
 * HP drops as the user's posture worsens (sick → nearly zero), and refills
 * whenever they return to a healthy neutral pose. Mood tracks the same shape
 * but decays faster: a moment of slouching dents mood more than HP, so the pet
 * visibly cheers up the instant posture is corrected.
 *
 * `asleep` intentionally preserves HP/mood — taking the glasses off should not
 * be interpreted as the user being in good *or* bad posture.
 */

export type PetVitals = {
  hp: number
  mood: number
  label: string
  emoji: string
}

export const VITALS_BY_STATE: Record<PostureState, PetVitals> = {
  healthy: { hp: 100, mood: 100, label: 'Happy', emoji: '(^_^)' },
  alert: { hp: 75, mood: 55, label: 'Slouching', emoji: '(._.)' },
  unwell: { hp: 40, mood: 25, label: 'Uncomfortable', emoji: '(>_<)' },
  // `sick` = the pet's HP fully drained after a sustained slouch. User
  // wants the bar to empty out (not stop at the old 10 minimum).
  sick: { hp: 0, mood: 0, label: 'Sick!', emoji: '(x_x)' },
  asleep: { hp: 100, mood: 100, label: 'Sleeping', emoji: '(-_-) z' },
  calibrating: { hp: 100, mood: 100, label: 'Calibrating…', emoji: '(o_o)' },
}

export function vitalsFor(state: PostureState): PetVitals {
  return VITALS_BY_STATE[state]
}
