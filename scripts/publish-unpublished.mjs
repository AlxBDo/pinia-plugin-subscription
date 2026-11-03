import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NPM = 'npm'
const SPAWN_OPTIONS = { encoding: 'utf8', shell: process.platform === 'win32' }
const NOT_FOUND_PATTERN = /\bE404\b|404 Not Found/

/**
 * Tells whether `npm view name@version version` found the version on the registry.
 * An unknown package (E404) or an unknown version (empty output) both mean "not published".
 * Any other failure (network, auth...) throws so a package is never skipped by mistake.
 */
export function isVersionPublished({ status, stdout, stderr }) {
    if (status === 0) return stdout.trim().length > 0
    if (NOT_FOUND_PATTERN.test(stderr)) return false
    throw new Error(`Unable to query the npm registry: ${stderr.trim() || `exit code ${status}`}`)
}

/** Keeps the root package first: workspaces may peer-depend on it. */
export function listPackageDirs(rootDir, workspaces = []) {
    return [rootDir, ...workspaces.map((workspace) => path.join(rootDir, workspace))]
}

export function parseDistTag(argv) {
    const index = argv.indexOf('--tag')
    return index === -1 ? undefined : argv[index + 1]
}

export function buildPublishArgs(distTag) {
    const args = ['publish', '--provenance', '--access', 'public']
    if (distTag) args.push('--tag', distTag)
    return args
}

function readManifest(dir) {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
}

function resolveWorkspaceDirs(rootDir, patterns = []) {
    return patterns.flatMap((pattern) => {
        if (!pattern.endsWith('/*')) return [pattern]
        const parent = pattern.slice(0, -2)
        const parentDir = path.join(rootDir, parent)
        if (!existsSync(parentDir)) return []
        return readdirSync(parentDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && existsSync(path.join(parentDir, entry.name, 'package.json')))
            .map((entry) => `${parent}/${entry.name}`)
    })
}

function main() {
    const rootDir = path.resolve(__dirname, '..')
    const distTag = parseDistTag(process.argv.slice(2))
    const rootManifest = readManifest(rootDir)
    const dirs = listPackageDirs(rootDir, resolveWorkspaceDirs(rootDir, rootManifest.workspaces))
    let failed = false

    for (const dir of dirs) {
        const { name, version, private: isPrivate } = readManifest(dir)
        if (isPrivate) {
            console.log(`- ${name}: private, skipped`)
            continue
        }

        const view = spawnSync(NPM, ['view', `${name}@${version}`, 'version'], { ...SPAWN_OPTIONS, cwd: dir })
        if (isVersionPublished({ status: view.status, stdout: view.stdout ?? '', stderr: view.stderr ?? '' })) {
            console.log(`- ${name}@${version}: already published, skipped`)
            continue
        }

        console.log(`- ${name}@${version}: publishing${distTag ? ` with tag ${distTag}` : ''}`)
        const publish = spawnSync(NPM, buildPublishArgs(distTag), { shell: SPAWN_OPTIONS.shell, cwd: dir, stdio: 'inherit' })
        if (publish.status !== 0) failed = true
    }

    if (failed) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main()
}
