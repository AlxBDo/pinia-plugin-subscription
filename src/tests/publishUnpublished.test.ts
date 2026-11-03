import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    buildPublishArgs,
    isVersionPublished,
    listPackageDirs,
    parseDistTag,
} from '../../scripts/publish-unpublished.mjs'

describe('isVersionPublished', () => {
    it('is published when npm view returns the version', () => {
        expect(isVersionPublished({ status: 0, stdout: '1.0.0\n', stderr: '' })).toBe(true)
    })

    it('is not published when the version is unknown', () => {
        expect(isVersionPublished({ status: 0, stdout: '', stderr: '' })).toBe(false)
    })

    it('is not published when the package does not exist yet', () => {
        expect(isVersionPublished({ status: 1, stdout: '', stderr: 'npm error code E404' })).toBe(false)
    })

    it('throws on any other registry failure', () => {
        expect(() => isVersionPublished({ status: 1, stdout: '', stderr: 'npm error code ENOTFOUND' })).toThrow(
            /Unable to query/,
        )
    })
})

describe('listPackageDirs', () => {
    it('lists the root first, then the workspaces', () => {
        expect(listPackageDirs('/repo', ['packages/devtools'])).toEqual([
            '/repo',
            path.join('/repo', 'packages/devtools'),
        ])
    })
})

describe('parseDistTag', () => {
    it('reads the value following --tag', () => {
        expect(parseDistTag(['--tag', 'beta'])).toBe('beta')
    })

    it('returns undefined without --tag', () => {
        expect(parseDistTag([])).toBeUndefined()
    })
})

describe('buildPublishArgs', () => {
    it('adds the tag only when provided', () => {
        expect(buildPublishArgs('beta')).toEqual(['publish', '--provenance', '--access', 'public', '--tag', 'beta'])
        expect(buildPublishArgs()).toEqual(['publish', '--provenance', '--access', 'public'])
    })
})
