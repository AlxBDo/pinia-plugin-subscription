import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'esbuild',
    reportCompressedSize: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'pinia-plugin-state-snapshots.js',
    },
    rollupOptions: {
      external: ['vue', /^pinia-plugin-subscription(\/.*)?$/],
      // propertyReadSideEffects must stay enabled: reading a ref's `.value` inside a computed is what registers the reactive dependency.
      treeshake: {
        moduleSideEffects: false,
      },
      plugins: [
        {
          name: 'strip-jsdoc-from-bundle',
          // JSDoc stays available to consumers through the generated .d.ts files.
          renderChunk(code) {
            return { code: code.replace(/\/\*\*[\s\S]*?\*\//g, ''), map: null }
          },
        },
      ],
      output: { generatedCode: 'es2015' },
    },
  },
})
