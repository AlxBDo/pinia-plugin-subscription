import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: [
            { find: /^pinia-plugin-subscription\/helpers$/, replacement: resolve(projectRoot, 'src/helpers/index.ts') },
            { find: /^pinia-plugin-subscription\/types$/, replacement: resolve(projectRoot, 'src/types/index.ts') },
            { find: /^pinia-plugin-subscription$/, replacement: resolve(projectRoot, 'src/lib/main.ts') },
        ],
    },
    test: {
        coverage: {
            enabled: true,
            exclude: [
                ...coverageConfigDefaults.exclude,
                '**/App.vue',
                '**/main.js',
                '**/module-declaration.ts',
                '**/components/**',
                '**/lib/**',
                '**/models/**',
                '**/stores/**',
                '**/types/**',
                '**/utils/Performance.ts',
                '**/utils/defineStoreId.ts',
                'scripts/**',
                '**/demo/**',
                '**/log/**'
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
            reporter: ['text', 'html'],
            provider: 'v8'
        },
        typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
            tsconfig: './tsconfig.test.json',
        },
    },
})