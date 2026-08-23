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

import {
    defineAStore,
    defineAStoreCtx,
    getDefineAStoreSetupContext,
    getEnhancedStore,
    getExtendingStore,
    setEnhancedStore
} from '../utils/store'

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
        expect(getDefineAStoreSetupContext(store)).toBeUndefined()
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
        expect(getDefineAStoreSetupContext(store)).toBeUndefined()
    })

    it('retrieves setup context by id before store registration in weak map when enhancedStore is enabled', () => {
        let setupContextFromPluginPhase: ReturnType<typeof getDefineAStoreSetupContext>

        const useStore = defineAStore('timingStore', () => ({
            count: ref(2)
        }), { enhancedStore: true })

        beforeReturnStoreMock.mockImplementation((store: { $id: string }) => {
            setupContextFromPluginPhase = getDefineAStoreSetupContext(store)
        })

        useStore()

        expect(setupContextFromPluginPhase).toEqual({
            id: 'timingStore',
            extensions: {}
        })
    })

    it('requires and provides typed context with defineAStoreCtx', () => {
        const useStore = defineAStoreCtx<{}, { count: number }, { initialCount?: number }>('ctxRequiredStore', (ctx) => {
            const initialCount = typeof ctx.extensions.initialCount === 'number'
                ? ctx.extensions.initialCount
                : 0

            return { count: ref(initialCount) }
        })

        const store = useStore()
        const setupContext = getDefineAStoreSetupContext(store)

        expect(store.$id).toBe('ctxRequiredStore')
        expect(setupContext?.id).toBe('ctxRequiredStore')
    })

    it('sets and retrieves enhanced store with extending backward compatibility', () => {
        const useStore = defineAStoreCtx<{ addItem: () => void }, {}>('enhancedStore', (ctx) => {
            const enhancedStore = { addItem: vi.fn() }
            setEnhancedStore(ctx, enhancedStore)

            return {
                enhancedFromNewKey: getEnhancedStore(ctx),
                enhancedFromDeprecatedKey: getExtendingStore(ctx)
            }
        })

        const store = useStore()

        expect(store.enhancedFromNewKey).toBeDefined()
        expect(store.enhancedFromDeprecatedKey).toBe(store.enhancedFromNewKey)
    })

    it('reuses setup context for duplicated store ids', () => {
        const storesById = new Map<string, { $id: string }>()

        defineStoreMock.mockImplementation((id: string, storeDefinition: unknown) => {
            const useStore = vi.fn(() => {
                let store = storesById.get(id)

                if (!store) {
                    store = {
                        $id: id,
                        ...((typeof storeDefinition === 'function' ? storeDefinition() : {}) as object)
                    } as { $id: string }
                    storesById.set(id, store)
                }

                beforeReturnStoreMock(store)
                return store
            })

            return Object.assign(useStore, { $id: id })
        })

        const useStoreA = defineAStoreCtx<{ getEnhanced: () => unknown }, {}>('sharedCtxStore', (ctx) => ({
            getEnhanced: () => getEnhancedStore(ctx)
        }))

        const storeA = useStoreA()
        const setupContext = getDefineAStoreSetupContext(storeA)
        expect(setupContext).toBeDefined()
        setEnhancedStore(setupContext!, storeA)

        const useStoreB = defineAStoreCtx<{ getEnhanced: () => unknown }, {}>('sharedCtxStore', (ctx) => ({
            getEnhanced: () => getEnhancedStore(ctx)
        }))

        const storeB = useStoreB()

        expect(storeB).toBe(storeA)
        expect(storeB.getEnhanced()).toBe(storeA)
    })
})
