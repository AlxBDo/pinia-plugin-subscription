import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { defineStoreMock, beforeReturnStoreMock } = vi.hoisted(() => ({
    beforeReturnStoreMock: vi.fn(),
    defineStoreMock: vi.fn((id: string, storeDefinition: unknown) => {
        const useStore = vi.fn(() => {
            const store = {
                $id: id,
                ...((typeof storeDefinition === 'function' ? storeDefinition() : {}) as object)
            }
            beforeReturnStoreMock(store)
            return store
        })

        return Object.assign(useStore, { $id: id })
    })
}))

vi.mock('pinia', async () => {
    const actual = await vi.importActual<typeof import('pinia')>('pinia')

    return {
        ...actual,
        defineStore: defineStoreMock
    }
})

import { defineAStore, getDefineAStoreSetupContext } from '../utils/store'

describe('defineAStore setup context', () => {
    beforeEach(() => {
        defineStoreMock.mockClear()
        beforeReturnStoreMock.mockClear()
    })

    it('keeps supporting setup callbacks without context', () => {
        const useStore = defineAStore('legacyStore', () => ({
            count: ref(0)
        }))

        const store = useStore()

        expect(store.$id).toBe('legacyStore')
        expect(store.count.value).toBe(0)
        expect(getDefineAStoreSetupContext(store)).toEqual({
            id: 'legacyStore',
            extensions: {}
        })
    })

    it('provides the setup context when requested', () => {
        let capturedContext: ReturnType<typeof getDefineAStoreSetupContext>

        const useStore = defineAStore('ctxStore', (ctx) => {
            capturedContext = ctx

            return {
                count: ref(1)
            }
        })

        const store = useStore()

        expect(capturedContext).toEqual({
            id: 'ctxStore',
            extensions: {}
        })
        expect(getDefineAStoreSetupContext(store)).toBe(capturedContext)
    })

    it('retrieves setup context by id before store registration in weak map', () => {
        let setupContextFromPluginPhase: ReturnType<typeof getDefineAStoreSetupContext>

        const useStore = defineAStore('timingStore', () => ({
            count: ref(2)
        }))

        beforeReturnStoreMock.mockImplementation((store: { $id: string }) => {
            setupContextFromPluginPhase = getDefineAStoreSetupContext(store)
        })

        useStore()

        expect(setupContextFromPluginPhase).toEqual({
            id: 'timingStore',
            extensions: {}
        })
    })
})
