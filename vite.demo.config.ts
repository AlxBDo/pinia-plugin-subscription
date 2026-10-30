import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [vue()],
  // Resolve the package to its sources: no build required, hot reload on src/ changes
  resolve: {
    alias: [
      { find: /^pinia-plugin-subscription\/helpers$/, replacement: resolve(__dirname, 'src/helpers/index.ts') },
      { find: /^pinia-plugin-subscription\/types$/, replacement: resolve(__dirname, 'src/types/index.ts') },
      { find: /^pinia-plugin-subscription$/, replacement: resolve(__dirname, 'src/lib/main.ts') },
    ],
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
  },
})
