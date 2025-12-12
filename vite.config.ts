import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/main.ts'),
      name: 'pinia-plugin-subscription',
      fileName: 'pinia-plugin-subscription',
    },
    rollupOptions: {
      external: ['pinia'],
      output: {
        globals: {
          pinia: 'Pinia'
        },
      },
    },
  },
})
