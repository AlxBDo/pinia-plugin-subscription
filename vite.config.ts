import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { pluginName } from './src/utils/constantes'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/main.ts'),
      name: pluginName,
      fileName: pluginName,
    },
    rollupOptions: {
      external: ['pinia', 'vue'],
      output: {
        globals: {
          pinia: 'Pinia',
          vue: 'Vue'
        },
      },
    },
  },
})
