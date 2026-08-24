import { describe, expect, it, vi } from 'vitest'
import { performance } from 'node:perf_hooks'
import { ref } from 'vue'

const { defineStoreMock } = vi.hoisted(() => ({
    defineStoreMock: vi.fn((id: string, storeDefinition: unknown) => {
        const useStore = vi.fn(() => ({
            $id: id,
            $dispose: vi.fn(),
            ...((typeof storeDefinition === 'function' ? storeDefinition() : {}) as object)
        }))

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

interface ScenarioMetrics {
    durationMs: number
    heapDeltaBytes: number
    trackedContextCount: number
    trackedByIdAfterSetupCount: number
}

function runScenario(storeCount: number, enhancedStore: boolean): ScenarioMetrics {
    const stores: Array<{ $id: string }> = []
    const startTime = performance.now()
    const startHeap = process.memoryUsage().heapUsed
    const idPrefix = enhancedStore ? 'enhanced' : 'standard'

    for (let index = 0; index < storeCount; index++) {
        const id = `bench-${idPrefix}-${index}`
        const useStore = defineAStore(id, () => ({
            value: ref(index)
        }), enhancedStore ? { enhancedStore: true } : {})
        stores.push(useStore())
    }

    const durationMs = performance.now() - startTime
    const heapDeltaBytes = process.memoryUsage().heapUsed - startHeap
    const trackedContextCount = stores.filter((store) => !!getDefineAStoreSetupContext(store)).length
    const trackedByIdAfterSetupCount = stores.filter((store) => !!getDefineAStoreSetupContext({ $id: store.$id })).length

    return { durationMs, heapDeltaBytes, trackedContextCount, trackedByIdAfterSetupCount }
}

describe('defineAStore setup context performance', () => {
    it('measures setup context tracking overhead with and without enhancedStore', () => {
        const storeCount = 400
        const standard = runScenario(storeCount, false)
        const enhanced = runScenario(storeCount, true)

        expect(standard.trackedContextCount).toBe(0)
        expect(enhanced.trackedContextCount).toBe(storeCount)
        expect(standard.trackedByIdAfterSetupCount).toBe(0)
        expect(enhanced.trackedByIdAfterSetupCount).toBe(0)
        expect(Number.isFinite(standard.durationMs)).toBe(true)
        expect(Number.isFinite(enhanced.durationMs)).toBe(true)
        expect(Number.isFinite(standard.heapDeltaBytes)).toBe(true)
        expect(Number.isFinite(enhanced.heapDeltaBytes)).toBe(true)
    })
})
