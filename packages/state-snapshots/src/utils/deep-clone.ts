import { isRef, toRaw } from 'vue'

export function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
    const activeRefs = new WeakSet<object>()

    function clone(input: unknown): unknown {
        if (input === null || input === undefined || typeof input === 'string'
            || typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
            return input
        }
        if (typeof input !== 'object') {
            throw new TypeError(`Unsupported snapshot value: ${typeof input}`)
        }

        const raw = toRaw(input)
        if (seen.has(raw)) {
            return seen.get(raw)
        }
        if (isRef(raw)) {
            if (activeRefs.has(raw)) {
                throw new TypeError('Circular Vue ref cannot be snapshotted')
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

        let result: object
        if (raw instanceof Date && Object.getPrototypeOf(raw) === Date.prototype) {
            result = new Date(raw.getTime())
        } else if (typeof URL !== 'undefined' && raw instanceof URL && Object.getPrototypeOf(raw) === URL.prototype) {
            const url = new URL(raw.href)
            const builtInKeys = new Set(Reflect.ownKeys(url))
            if (Reflect.ownKeys(raw).some(key => !builtInKeys.has(key))) {
                throw new TypeError('URL snapshot values cannot have custom properties')
            }
            seen.set(raw, url)
            return url
        } else if (raw instanceof Map && Object.getPrototypeOf(raw) === Map.prototype) {
            const map = new Map()
            seen.set(raw, map)
            for (const [key, entry] of raw) {
                map.set(clone(key), clone(entry))
            }
            result = map
        } else if (raw instanceof Set && Object.getPrototypeOf(raw) === Set.prototype) {
            const set = new Set()
            seen.set(raw, set)
            for (const entry of raw) {
                set.add(clone(entry))
            }
            result = set
        } else if (Array.isArray(raw) && Object.getPrototypeOf(raw) === Array.prototype) {
            result = new Array(raw.length)
        } else if (Object.getPrototypeOf(raw) === Object.prototype || Object.getPrototypeOf(raw) === null) {
            result = Object.create(Object.getPrototypeOf(raw))
        } else {
            throw new TypeError(`Unsupported snapshot object: ${Object.prototype.toString.call(raw)}`)
        }

        seen.set(raw, result)
        for (const key of Reflect.ownKeys(raw)) {
            if (Array.isArray(raw) && key === 'length') {
                continue
            }
            if (typeof key === 'symbol' || key === '__proto__') {
                throw new TypeError(`Unsupported snapshot property: ${String(key)}`)
            }
            const descriptor = Object.getOwnPropertyDescriptor(raw, key)
            if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
                throw new TypeError(`Unsupported snapshot property descriptor: ${key}`)
            }
            Object.defineProperty(result, key, {
                value: clone(descriptor.value),
                enumerable: true,
                configurable: true,
                writable: true
            })
        }
        return result
    }

    return clone(value) as T
}
