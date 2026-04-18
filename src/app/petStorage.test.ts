import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadPetType, savePetType } from './petStorage'

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v))
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => {
        store.clear()
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size
      },
    },
  })
}

describe('petStorage', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
  })

  it('returns fallback when nothing stored', () => {
    expect(loadPetType()).toBe('fish')
    expect(loadPetType('turtle')).toBe('turtle')
  })

  it('round-trips valid values', () => {
    savePetType('jellyfish')
    expect(loadPetType()).toBe('jellyfish')
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem('evenpet:pet-type', 'dragon')
    expect(loadPetType('butterfly')).toBe('butterfly')
  })

  it('tolerates localStorage failures', () => {
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadPetType()).toBe('fish')
    spy.mockRestore()
  })
})
