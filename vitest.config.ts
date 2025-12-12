import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
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
                '**/utils/defineStoreId.ts'
            ],
            reporter: ['text', 'html'],
            provider: 'v8'
        },
    },
})