export type PetType = 'fish' | 'jellyfish' | 'turtle' | 'butterfly'

export const PET_TYPES: PetType[] = ['fish', 'jellyfish', 'turtle', 'butterfly']

export const PET_LABELS: Record<PetType, string> = {
  fish: '🐟 Fish',
  jellyfish: '🪼 Jellyfish',
  turtle: '🐢 Turtle',
  butterfly: '🦋 Butterfly',
}

export interface PreviewRenderModel {
  visible: boolean
  petType: PetType
  sceneCanvas: HTMLCanvasElement
  connectionLabel: string
}
