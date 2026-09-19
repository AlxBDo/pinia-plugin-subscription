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

    if (value === null || typeof value !== 'object') {
        return value
    }

    if (value instanceof Map) {
        return new Map(
            Array.from(value.entries(), ([key, entryValue]) => [deepClone(key), deepClone(entryValue)])
        ) as T
    }

    if (value instanceof Set) {
        return new Set(Array.from(value.values(), entryValue => deepClone(entryValue))) as T
    }

    if (Array.isArray(value)) {
        return value.map(item => deepClone(item)) as T
    }

    if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepClone(item)])
        ) as T
    }

    const clonedObject = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        clonedObject[key] = deepClone(item)
    }

    return clonedObject as T
}