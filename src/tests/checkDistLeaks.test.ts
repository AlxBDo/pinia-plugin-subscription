import { describe, expect, it } from 'vitest'
import {
    collectSpecifiers,
    findLeaks,
    isRelativeSpecifier,
    toPackageName,
} from '../../scripts/check-dist-leaks.mjs'

describe('toPackageName', () => {
    it('keeps a plain package name', () => {
        expect(toPackageName('pinia')).toBe('pinia')
    })

    it('strips subpaths', () => {
        expect(toPackageName('pinia/dist/pinia')).toBe('pinia')
    })

    it('keeps both segments of a scoped package', () => {
        expect(toPackageName('@vue/runtime-core/dist/index')).toBe('@vue/runtime-core')
    })

    it('strips the node protocol', () => {
        expect(toPackageName('node:fs')).toBe('fs')
    })
})

describe('isRelativeSpecifier', () => {
    it.each(['./Store', '../types/index.js', '/abs/path'])('detects %s as relative', (specifier) => {
        expect(isRelativeSpecifier(specifier)).toBe(true)
    })

    it('detects a bare specifier as non relative', () => {
        expect(isRelativeSpecifier('ts-trace-decorators')).toBe(false)
    })
})

describe('collectSpecifiers', () => {
    it('ignores relative imports', () => {
        expect(collectSpecifiers("import { Store } from './Store.js'")).toEqual([])
    })

    it('detects a type-only import, as emitted by tsc in .d.ts', () => {
        expect(collectSpecifiers("import type { TraceInstanceConfig } from 'ts-trace-decorators';"))
            .toEqual([{ specifier: 'ts-trace-decorators', line: 1 }])
    })

    it.each([
        ['static import', "import x from 'pkg'"],
        ['re-export', "export { x } from 'pkg'"],
        ['dynamic import', "const x = await import('pkg')"],
        ['require call', "const x = require('pkg')"],
        ['side-effect import', "import 'pkg'"],
        ['module augmentation', "declare module 'pkg' { }"],
    ])('detects a %s', (_label, source) => {
        expect(collectSpecifiers(source)).toContainEqual({ specifier: 'pkg', line: 1 })
    })

    it('reports the 1-based line number', () => {
        const source = ["import { a } from './a.js'", '', "import b from 'pkg'"].join('\n')

        expect(collectSpecifiers(source)).toEqual([{ specifier: 'pkg', line: 3 }])
    })

    it('ignores import-like text in line comments', () => {
        expect(collectSpecifiers("// import value from 'dev-only'")).toEqual([])
    })

    it('ignores import-like text in block comments', () => {
        const source = [
            '/**',
            " * Use `declare module 'pinia-plugin-subscription/types'` to augment types.",
            ' */',
            "import type { Store } from 'pinia'",
        ].join('\n')

        expect(collectSpecifiers(source)).toEqual([{ specifier: 'pinia', line: 4 }])
    })
})

describe('findLeaks', () => {
    const peerDependencies = ['pinia', 'vue']

    it('allows peer dependencies', () => {
        const files = [{ file: 'types/index.d.ts', source: "import type { Pinia } from 'pinia';" }]

        expect(findLeaks(files, peerDependencies)).toEqual([])
    })

    it('allows node builtins', () => {
        const files = [{ file: 'index.js', source: "import { readFileSync } from 'node:fs'" }]

        expect(findLeaks(files, peerDependencies)).toEqual([])
    })

    it('reports a devDependency leaking through a .d.ts', () => {
        const files = [{
            file: 'core/Store.d.ts',
            source: "import type { TraceInstanceConfig } from 'ts-trace-decorators';",
        }]

        expect(findLeaks(files, peerDependencies)).toEqual([{
            file: 'core/Store.d.ts',
            line: 1,
            specifier: 'ts-trace-decorators',
            packageName: 'ts-trace-decorators',
        }])
    })

    it('reports a leak reached through a subpath', () => {
        const files = [{ file: 'index.js', source: "import { sanitize } from 'ts-trace-decorators/utils'" }]

        expect(findLeaks(files, peerDependencies)).toMatchObject([{
            specifier: 'ts-trace-decorators/utils',
            packageName: 'ts-trace-decorators',
        }])
    })

    it('deduplicates identical occurrences', () => {
        const files = [{ file: 'index.js', source: "export { a } from 'pkg'" }]

        expect(findLeaks(files, peerDependencies)).toHaveLength(1)
    })

    it('returns no leak for a clean build', () => {
        const files = [
            { file: 'index.js', source: "import { defineStore } from 'pinia'" },
            { file: 'core/Store.d.ts', source: "import type { Ref } from 'vue';" },
        ]

        expect(findLeaks(files, peerDependencies)).toEqual([])
    })
})
