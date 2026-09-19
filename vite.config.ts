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
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/lib/main.ts'),
        helpers: resolve(__dirname, 'src/helpers/index.ts'),
      },
      name: pluginName,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['pinia', 'vue'],
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
      plugins: [
        {
          name: 'strip-jsdoc-from-bundle',
          // esbuild preserves JSDoc containing '@' annotations (@param, @returns...)
          // even when minifying. They add ~3 KB to the published bundle while the
          // documentation remains available to consumers in the generated .d.ts files.
          renderChunk(code) {
            return { code: code.replace(/\/\*\*[\s\S]*?\*\//g, ''), map: null }
          },
        },
      ],
      output: {
        exports: 'named',
        entryFileNames: (chunkInfo) => {
          const entryName = chunkInfo.name
          if (entryName === 'index') {
            return `${pluginName}.js`
          }

          return `${entryName}.js`
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        generatedCode: 'es2015',
      },
    },
  },
})
