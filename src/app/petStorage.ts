import { PET_TYPES, type PetType } from './types'

const STORAGE_KEY = 'evenpet:pet-type'

export function loadPetType(fallback: PetType = 'fish'): PetType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null && (PET_TYPES as readonly string[]).includes(saved)) {
      return saved as PetType
    }
  } catch {
    /* localStorage unavailable (private mode, SSR) */
  }
  return fallback
}

export function savePetType(petType: PetType): void {
  try {
    localStorage.setItem(STORAGE_KEY, petType)
  } catch {
    /* localStorage unavailable */
  }
}
