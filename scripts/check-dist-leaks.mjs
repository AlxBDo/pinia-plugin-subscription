import { readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SCANNED_EXTENSIONS = /\.(js|cjs|mjs|d\.ts|d\.cts|d\.mts)$/

const SPECIFIER_PATTERNS = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bdeclare\s+module\s+['"]([^'"]+)['"]/g,
]

/**
 * Reduces a module specifier to its package name.
 * `@scope/pkg/sub` -> `@scope/pkg`, `pinia/dist/x` -> `pinia`.
 */
export function toPackageName(specifier) {
    const withoutProtocol = specifier.replace(/^node:/, '')
    const segments = withoutProtocol.split('/')

    return withoutProtocol.startsWith('@')
        ? segments.slice(0, 2).join('/')
        : segments[0]
}

export function isRelativeSpecifier(specifier) {
    return specifier.startsWith('.') || specifier.startsWith('/')
}

/**
 * Extracts every bare module specifier of a built file, with its 1-based line number.
 */
export function collectSpecifiers(source) {
    const lines = source.split(/\r?\n/)
    const found = []
    let inBlockComment = false

    lines.forEach((line, index) => {
        let code = ''
        let cursor = 0

        while (cursor < line.length) {
            if (inBlockComment) {
                const blockEnd = line.indexOf('*/', cursor)
                if (blockEnd === -1) {
                    cursor = line.length
                    continue
                }

                inBlockComment = false
                cursor = blockEnd + 2
                continue
            }

            const blockStart = line.indexOf('/*', cursor)
            const lineComment = line.indexOf('//', cursor)

            if (lineComment !== -1 && (blockStart === -1 || lineComment < blockStart)) {
                code += line.slice(cursor, lineComment)
                break
            }

            if (blockStart === -1) {
                code += line.slice(cursor)
                break
            }

            code += line.slice(cursor, blockStart)
            inBlockComment = true
            cursor = blockStart + 2
        }

        for (const pattern of SPECIFIER_PATTERNS) {
            pattern.lastIndex = 0
            let match

            while ((match = pattern.exec(code)) !== null) {
                const specifier = match[1]

                if (isRelativeSpecifier(specifier)) {
                    continue
                }

                found.push({ specifier, line: index + 1 })
            }
        }
    })

    return found
}

/**
 * Returns the specifiers a consumer would not be able to resolve.
 * Node builtins and declared peer dependencies are always allowed.
 */
export function findLeaks(files, allowedPackages) {
    const allowed = new Set([...allowedPackages, ...builtinModules])
    const leaks = []
    const seen = new Set()

    for (const { file, source } of files) {
        for (const { specifier, line } of collectSpecifiers(source)) {
            const packageName = toPackageName(specifier)

            if (allowed.has(packageName)) {
                continue
            }

            const key = `${file}:${line}:${specifier}`

            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            leaks.push({ file, line, specifier, packageName })
        }
    }

    return leaks
}

function readBuiltFiles(directory, rootDirectory = directory) {
    const entries = []

    for (const entry of readdirSync(directory)) {
        const entryPath = path.join(directory, entry)

        if (statSync(entryPath).isDirectory()) {
            entries.push(...readBuiltFiles(entryPath, rootDirectory))
            continue
        }

        if (!SCANNED_EXTENSIONS.test(entry)) {
            continue
        }

        entries.push({
            file: path.relative(rootDirectory, entryPath).replaceAll(path.sep, '/'),
            source: readFileSync(entryPath, 'utf8'),
        })
    }

    return entries
}

function run() {
    const rootDir = path.resolve(__dirname, '..')
    const distDir = path.join(rootDir, 'dist')

    if (!statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
        console.error('dist/ not found: run `npm run build` before checking for leaks.')
        process.exit(1)
    }

    const manifest = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
    const allowedPackages = Object.keys(manifest.peerDependencies ?? {})
    const files = readBuiltFiles(distDir)
    const leaks = findLeaks(files, allowedPackages)

    if (leaks.length > 0) {
        console.error(`Dependency leak detected in dist/ (${leaks.length} occurrence(s)):`)

        for (const leak of leaks) {
            console.error(`- dist/${leak.file}:${leak.line} imports "${leak.specifier}"`)
        }

        console.error(
            '\nOnly peer dependencies may appear in published artifacts.' +
            '\nA devDependency referenced here is not installed on the consumer side,' +
            '\nso it breaks type-checking (.d.ts) or resolution (.js).' +
            '\nRemove the import from src/, or duplicate the needed type in src/types/.'
        )
        process.exit(1)
    }

    console.log(
        `No dependency leak in dist/ (${files.length} files scanned, ` +
        `allowed: ${allowedPackages.join(', ') || 'none'} + node builtins).`
    )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    run()
}
