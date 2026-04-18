export type PetType = 'fish' | 'jellyfish' | 'turtle' | 'butterfly'

export const PET_TYPES = ['fish', 'jellyfish', 'turtle', 'butterfly'] as const

export const PET_LABELS: Record<PetType, string> = {
  fish: '🐟 Fish',
  jellyfish: '🪼 Jellyfish',
  turtle: '🐢 Turtle',
  butterfly: '🦋 Butterfly',
}

export interface MovementParams {
  fx1: number
  fx2: number
  fy1: number
  fy2: number
  ax1: number
  ax2: number
  ay1: number
  ay2: number
  px2: number
  py1: number
  py2: number
}

export interface PreviewRenderModel {
  visible: boolean
  petType: PetType
  sceneCanvas: HTMLCanvasElement
  connectionLabel: string
  hp: number
  mood: number
  moodLabel: string
  moodEmoji: string
  stateLabel: string
  deviationDeg: number
  calibrated: boolean
  wearing: boolean
  debug: DebugSnapshot
}

export interface DebugSnapshot {
  imuCount: number
  lastImu: { t: number; x: number; y: number; z: number } | null
  imuAgeMs: number | null
  slouchMs: number
  toastStatus: 'idle' | 'showing' | 'cooldown'
  toastCooldownLeftMs: number
}
