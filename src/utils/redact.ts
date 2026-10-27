import type { AnyObject } from '../types'
import type { TraceRedactOptions } from '../types/trace'

export const DEFAULT_REDACTED_VALUE = '[REDACTED]'

/**
 * Keys masked by default when redaction is enabled.
 * Matching is a case-insensitive "contains", so `accessToken` or `user_password` are masked too.
 */
export const defaultRedactedKeys: readonly RegExp[] = [
    /pass(word|wd|phrase|code)|^pwd/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /api[-_]?key/i,
    /(private|encryption|signing|secret)[-_]?key/i,
    /credential/i,
    /cookie/i,
    /cipher/i,
]

const MAX_DEPTH = 12

type KeyMatcher = (key: string) => boolean

function createKeyMatcher(keys: ReadonlyArray<string | RegExp>): KeyMatcher {
    const exact = new Set<string>()
    const patterns: RegExp[] = []

    for (const key of keys) {
        if (typeof key === 'string') {
            exact.add(key.toLowerCase())
        } else {
            // a global/sticky regexp is stateful: rebuild it without those flags
            patterns.push(new RegExp(key.source, key.flags.replace(/[gy]/g, '')))
        }
    }

    return (key: string) => exact.has(key.toLowerCase()) || patterns.some(pattern => pattern.test(key))
}

function isTraversable(value: unknown): value is object {
    if (value === null || typeof value !== 'object') {
        return false
    }

    return !(
        value instanceof Date
        || value instanceof RegExp
        || value instanceof Error
        || value instanceof Promise
        || value instanceof WeakMap
        || value instanceof WeakSet
    )
}

/**
 * Creates a function returning a redacted copy of a trace payload.
 * The original value (usually the live store state) is never mutated.
 * @param options Redaction options, or `true` to use the default keys.
 * @returns The redaction function.
 */
export function createRedactor(options: TraceRedactOptions | true = true): (payload: AnyObject) => AnyObject {
    const { includeDefaults = true, keys = [], replacement = DEFAULT_REDACTED_VALUE } =
        options === true ? {} : options
    const isSensitive = createKeyMatcher([...(includeDefaults ? defaultRedactedKeys : []), ...keys])

    function redact(value: unknown, seen: WeakMap<object, unknown>, depth: number): unknown {
        if (!isTraversable(value)) {
            return value
        }

        const cached = seen.get(value)
        if (cached !== undefined) {
            return cached
        }

        if (depth >= MAX_DEPTH) {
            return '[MaxDepth]'
        }

        if (value instanceof Map) {
            const copy = new Map()
            seen.set(value, copy)
            value.forEach((entry, key) => {
                copy.set(key, typeof key === 'string' && isSensitive(key) ? replacement : redact(entry, seen, depth + 1))
            })
            return copy
        }

        if (value instanceof Set) {
            const copy = new Set()
            seen.set(value, copy)
            value.forEach(entry => copy.add(redact(entry, seen, depth + 1)))
            return copy
        }

        if (Array.isArray(value)) {
            const copy: unknown[] = []
            seen.set(value, copy)
            value.forEach(entry => copy.push(redact(entry, seen, depth + 1)))
            return copy
        }

        const copy: Record<string, unknown> = {}
        seen.set(value, copy)
        for (const key of Object.keys(value)) {
            const redactedValue = isSensitive(key)
                ? replacement
                : redact((value as Record<string, unknown>)[key], seen, depth + 1)
            Object.defineProperty(copy, key, {
                configurable: true,
                enumerable: true,
                value: redactedValue,
                writable: true
            })
        }
        return copy
    }

    return payload => redact(payload, new WeakMap(), 0) as AnyObject
}
