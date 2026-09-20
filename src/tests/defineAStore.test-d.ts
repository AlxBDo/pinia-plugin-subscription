import { describe, expectTypeOf, it } from 'vitest'
import { computed, ref } from 'vue'

import type { StoreDefinition } from 'pinia'
import type { DefineAStoreDefinition } from '../types/store'
import { defineAStore, defineAStoreCtx } from '../utils/store'

interface CounterState {
    count: number
}

interface CounterStore {
    increment: (step?: number) => number
}

/**
 * Compile-only contracts for defineAStore/defineAStoreCtx typings: store
 * members (state, getters, actions) must be exposed with precise types so
 * IDEs list them and display action prototypes.
 */
describe('defineAStore typings', () => {
    it('infers state, getters and actions from the setup function return', () => {
        const useCounterStore = defineAStore('inferredCounter', () => {
            const count = ref(0)
            const double = computed(() => count.value * 2)

            function increment(step: number = 1): number {
                count.value += step
                return count.value
            }

            return { count, double, increment }
        })

        const store = useCounterStore()

        expectTypeOf(store.$id).toEqualTypeOf<'inferredCounter'>()
        expectTypeOf(store.count).toEqualTypeOf<number>()
        expectTypeOf(store.double).toEqualTypeOf<number>()
        expectTypeOf(store.increment).toEqualTypeOf<(step?: number) => number>()
    })

    it('infers state, getters and actions from an options API definition', () => {
        const useOptionsStore = defineAStore('inferredOptions', {
            state: () => ({ name: 'initial' }),
            getters: {
                upperName: (state) => state.name.toUpperCase()
            },
            actions: {
                rename(name: string) {
                    this.name = name
                }
            }
        })

        const store = useOptionsStore()

        expectTypeOf(store.$id).toEqualTypeOf<'inferredOptions'>()
        expectTypeOf(store.name).toEqualTypeOf<string>()
        expectTypeOf(store.upperName).toEqualTypeOf<string>()
        expectTypeOf(store.rename).toEqualTypeOf<(name: string) => void>()
    })

    it('keeps explicit store/state typings for plugin-augmented stores', () => {
        const useAugmentedStore = defineAStore<CounterStore, CounterState>('augmentedCounter', () => ({
            count: ref(0)
        }))

        expectTypeOf(useAugmentedStore).toEqualTypeOf<DefineAStoreDefinition<CounterStore, CounterState>>()
        expectTypeOf(useAugmentedStore).toMatchTypeOf<StoreDefinition>()

        const store = useAugmentedStore()

        expectTypeOf(store.count).toEqualTypeOf<number>()
        expectTypeOf(store.increment).toEqualTypeOf<(step?: number) => number>()
    })

    it('types the setup context from explicit store/state types', () => {
        const useAugmentedStore = defineAStore<CounterStore, CounterState>('augmentedCtx', (ctx) => {
            expectTypeOf(ctx?.extensions.enhancedStore).toEqualTypeOf<(CounterStore & CounterState) | undefined>()

            return { count: ref(0) }
        })

        const store = useAugmentedStore()

        expectTypeOf(store.count).toEqualTypeOf<number>()
    })

    it('infers store members with defineAStoreCtx', () => {
        const useCtxStore = defineAStoreCtx('inferredCtx', () => {
            const count = ref(0)

            function increment(step: number = 1): number {
                count.value += step
                return count.value
            }

            return { count, increment }
        })

        const store = useCtxStore()

        expectTypeOf(store.count).toEqualTypeOf<number>()
        expectTypeOf(store.increment).toEqualTypeOf<(step?: number) => number>()
    })

    it('keeps explicit store/state and extra extensions typings with defineAStoreCtx', () => {
        const useLegacyCtxStore = defineAStoreCtx<CounterStore, CounterState, { initialCount?: number }>(
            'legacyCtx',
            (ctx) => {
                expectTypeOf(ctx.extensions.initialCount).toEqualTypeOf<number | undefined>()

                return { count: ref(ctx.extensions.initialCount ?? 0) }
            }
        )

        const store = useLegacyCtxStore()

        expectTypeOf(store.count).toEqualTypeOf<number>()
        expectTypeOf(store.increment).toEqualTypeOf<(step?: number) => number>()
    })
})
