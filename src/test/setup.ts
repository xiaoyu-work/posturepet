import { installCanvasMock } from './canvas-mock'

installCanvasMock()

// vitest's jsdom env exposes `localStorage` as a plain `{}` in some setups,
// which breaks `.clear()` / `.getItem()` / `.setItem()`. Install a tiny in-memory
// Storage shim so tests that touch localStorage behave predictably.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value))
    },
  }
}

const shim = createMemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true })
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: shim, configurable: true })
}
