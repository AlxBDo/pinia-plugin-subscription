import type { ToSerializableOptions } from '../types/trace'

const maxStringLength = 2000

/**
 * Converts any value (live stores, class instances, circular graphs...) into a bounded, JSON-safe
 * structure that is also readable in a UI. Keys starting with `_` (Vue/Pinia internals) are skipped.
 */
export function toSerializable(
    value: unknown,
    { maxDepth = 5, maxEntries = 100, maxNodes = 2000 }: ToSerializableOptions = {}
): unknown {
    const ancestors = new Set<object>()
    let nodes = 0

    function convert(current: unknown, depth: number): unknown {
        switch (typeof current) {
            case 'string':
                return current.length > maxStringLength ? `${current.slice(0, maxStringLength)}…` : current
            case 'number':
                return Number.isFinite(current) ? current : String(current)
            case 'boolean':
                return current
            case 'undefined':
                return '[undefined]'
            case 'bigint':
                return `${current}n`
            case 'symbol':
                return current.toString()
            case 'function':
                return `[Function ${current.name || 'anonymous'}]`
        }

        if (current === null) { return null }

        const object = current as object
        if (ancestors.has(object)) { return '[Circular]' }
        if (++nodes > maxNodes) { return '[Truncated]' }
        if (object instanceof Date) { return Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString() }
        if (object instanceof Error) { return { message: object.message, name: object.name } }

        const isCollection = Array.isArray(object) || object instanceof Set || object instanceof Map
        if (depth >= maxDepth) {
            return isCollection ? `[${object.constructor.name}]` : '[Object]'
        }

        ancestors.add(object)
        try {
            if (Array.isArray(object) || object instanceof Set) {
                const items = [...object]
                const result = items.slice(0, maxEntries).map(item => convert(item, depth + 1))
                if (items.length > maxEntries) { result.push(`… ${items.length - maxEntries} more`) }
                return object instanceof Set ? { __type: 'Set', values: result } : result
            }

            if (object instanceof Map) {
                return { __type: 'Map', entries: convert([...object.entries()], depth) }
            }

            const result: Record<string, unknown> = {}
            const keys = Object.keys(object).filter(key => !key.startsWith('_'))
            for (const key of keys.slice(0, maxEntries)) {
                try {
                    result[key] = convert((object as Record<string, unknown>)[key], depth + 1)
                } catch {
                    result[key] = '[Unreadable]'
                }
            }
            if (keys.length > maxEntries) { result['…'] = `${keys.length - maxEntries} more` }
            return result
        } finally {
            ancestors.delete(object)
        }
    }

    return convert(value, 0)
}

/**
 * JSON for embedding in an HTML `<script type="application/json">` element: neutralizes `<` and line separators.
 */
export function stringifyForHtml(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}
