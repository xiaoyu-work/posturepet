import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { imuLogPlugin } from './vite-imu-log-plugin'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  plugins: [imuLogPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        imuDebug: resolve(__dirname, 'imu-debug.html'),
      },
    },
  },
})
