import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
