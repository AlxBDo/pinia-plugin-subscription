import { isRef, toRaw } from 'vue'

/**
 * Deeply clones the provided value, handling objects, arrays, maps, and sets. Uses `structuredClone` if available, otherwise falls back to a manual deep clone.
 * @template T The type of the value to deep clone.
 * @param value The value to deep clone.
 * @returns A deep clone of the provided value.
 */
export function deepClone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        } catch {
            // fall through to the safe manual clone below
        }
    }

    const seen = new WeakMap<object, unknown>()
    const activeRefs = new WeakSet<object>()
    function clone(input: unknown): unknown {
        if (input === null || typeof input !== 'object') {
            return input
        }
        const raw = toRaw(input)
        if (seen.has(raw)) {
            return seen.get(raw)
        }
        if (isRef(raw)) {
            if (activeRefs.has(raw)) {
                throw new TypeError('Cannot clone a circular Vue ref')
            }
            activeRefs.add(raw)
            try {
                const result = clone(raw.value)
                seen.set(raw, result)
                return result
            } finally {
                activeRefs.delete(raw)
            }
        }
        if (raw instanceof Date) {
            const result = new Date(raw.getTime())
            seen.set(raw, result)
            return result
        }
        if (raw instanceof Map) {
            const result = new Map()
            seen.set(raw, result)
            for (const [key, entry] of raw) {
                result.set(clone(key), clone(entry))
            }
            return result
        }
        if (raw instanceof Set) {
            const result = new Set()
            seen.set(raw, result)
            for (const entry of raw) {
                result.add(clone(entry))
            }
            return result
        }
        const result: Record<string, unknown> | unknown[] = Array.isArray(raw)
            ? new Array(raw.length)
            : Object.create(Object.getPrototypeOf(raw))
        seen.set(raw, result)
        for (const [key, item] of Object.entries(input)) {
            Object.defineProperty(result, key, {
                value: clone(item), enumerable: true, configurable: true, writable: true
            })
        }
        return result
    }
    return clone(value) as T
}