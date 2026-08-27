import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { pluginName } from './src/utils/constantes'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'esbuild',
    reportCompressedSize: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/lib/main.ts'),
      name: pluginName,
      fileName: pluginName,
    },
    rollupOptions: {
      external: ['pinia', 'vue'],
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
      output: {
        exports: 'named',
        globals: {
          pinia: 'Pinia',
          vue: 'Vue'
        },
        generatedCode: 'es2015',
      },
    },
  },
})
