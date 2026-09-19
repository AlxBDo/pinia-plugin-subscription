import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { deepClone } from '../utils/deep-clone'

describe('deepClone', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('with native structuredClone', () => {
        it('should return a deep copy of nested objects and arrays', () => {
            const original = { user: { name: 'Ada', tags: ['a', 'b'] }, list: [{ id: 1 }] }

            const clone = deepClone(original)

            expect(clone).toEqual(original)
            expect(clone).not.toBe(original)
            expect(clone.user).not.toBe(original.user)
            expect(clone.user.tags).not.toBe(original.user.tags)
            expect(clone.list[0]).not.toBe(original.list[0])
        })

        it('should clone Map and Set values', () => {
            const original = {
                records: new Map<string, { nested: number }>([['first', { nested: 1 }]]),
                tags: new Set([{ nested: 2 }])
            }

            const clone = deepClone(original)

            expect(clone.records).not.toBe(original.records)
            expect(clone.records.get('first')).toEqual({ nested: 1 })
            expect(clone.records.get('first')).not.toBe(original.records.get('first'))
            expect(clone.tags).not.toBe(original.tags)
            expect(Array.from(clone.tags)).toEqual([{ nested: 2 }])
        })

        it('should fall back to the manual clone when the value cannot be structured-cloned', () => {
            const fn = () => 1
            const original = { fn, nested: { count: 1 } }

            const clone = deepClone(original)

            expect(clone.fn).toBe(fn)
            expect(clone.nested).toEqual({ count: 1 })
            expect(clone.nested).not.toBe(original.nested)
        })
    })

    describe('fallback without structuredClone', () => {
        beforeEach(() => {
            vi.stubGlobal('structuredClone', undefined)
        })

        it.each([null, undefined, 42, 'text', true])('should return the primitive value "%s" as-is', (value) => {
            expect(deepClone(value)).toBe(value)
        })

        it('should deep clone plain objects', () => {
            const original = { user: { name: 'Ada', tags: ['a'] }, count: 1 }

            const clone = deepClone(original)

            expect(clone).toEqual(original)
            expect(clone).not.toBe(original)
            expect(clone.user).not.toBe(original.user)
            original.user.tags.push('b')
            expect(clone.user.tags).toEqual(['a'])
        })

        it('should deep clone arrays and their items', () => {
            const original = [{ id: 1 }, { id: 2 }]

            const clone = deepClone(original)

            expect(clone).toEqual(original)
            expect(clone).not.toBe(original)
            expect(clone[0]).not.toBe(original[0])
        })

        it('should deep clone Map keys and values', () => {
            const key = { id: 'key' }
            const original = new Map<object, { nested: number[] }>([[key, { nested: [1] }]])

            const clone = deepClone(original)

            expect(clone).not.toBe(original)
            expect(clone.size).toBe(1)
            for (const [clonedKey, clonedValue] of clone) {
                expect(clonedKey).toEqual(key)
                expect(clonedKey).not.toBe(key)
                expect(clonedValue).toEqual({ nested: [1] })
                expect(clonedValue.nested).not.toBe(original.get(key)?.nested)
            }
        })

        it('should deep clone Set entries', () => {
            const entry = { nested: 2 }
            const original = new Set<unknown>([entry, 'ready'])

            const clone = deepClone(original)

            expect(clone).not.toBe(original)
            expect(clone.size).toBe(2)
            const clonedEntry = Array.from(clone).find(item => typeof item === 'object')
            expect(clonedEntry).toEqual({ nested: 2 })
            expect(clonedEntry).not.toBe(entry)
        })

        it('should deep clone objects created with a null prototype', () => {
            const original = Object.create(null) as Record<string, unknown>
            original.nested = { count: 1 }

            const clone = deepClone(original) as Record<string, unknown>

            expect(clone).toEqual(original)
            expect(clone.nested).not.toBe(original.nested)
        })

        it('should preserve the prototype of class instances and deep clone their properties', () => {
            class Counter {
                count = 0
                meta = { tags: ['a'] }
                increment() { this.count++ }
            }
            const original = new Counter()

            const clone = deepClone(original)

            expect(clone).toBeInstanceOf(Counter)
            expect(clone).not.toBe(original)
            expect(clone.meta).not.toBe(original.meta)
            clone.increment()
            expect(clone.count).toBe(1)
            expect(original.count).toBe(0)
        })
    })

    describe('when structuredClone throws', () => {
        it('should fall back to the manual clone', () => {
            const structuredCloneMock = vi.fn(() => { throw new Error('DataCloneError') })
            vi.stubGlobal('structuredClone', structuredCloneMock)
            const original = { nested: { count: 1 } }

            const clone = deepClone(original)

            expect(structuredCloneMock).toHaveBeenCalledWith(original)
            expect(clone).toEqual(original)
            expect(clone.nested).not.toBe(original.nested)
        })
    })
})
