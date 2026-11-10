import { createPinia, defineStore } from 'pinia'
import { PluginSubscription, STORE_EVENTS, StoreEventsSubscriber } from 'pinia-plugin-subscription/helpers'
import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import StoreEventsSubscriberHandler from '../../../../src/events/store-events-subscriber-handler'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'
import { StateSnapshotsSubscriberClass } from '../plugin/state-snapshots-subscriber'

import type { PiniaPluginContext } from 'pinia'
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/types'

function createContext(rollback = true): PiniaPluginContext {
    const pinia = createPinia()
    const useStore = defineStore('snapshots-test', {
        state: () => ({ count: 0 }),
        actions: {
            fail() {
                this.count++
                throw new Error('action failed')
            }
        }
    })
    const options: PiniaPluginContext['options'] = {
        actions: {},
        ...(rollback ? { storeOptions: { rollbackAfterFailure: { fail: 'all' } } } : {})
    }
    return { app: createApp({}), pinia, store: useStore(pinia), options }
}

describe('state snapshots subscriber', () => {
    it('adds manual rollback and disposal cleanup without snapshot options', () => {
        const subscriber = new StateSnapshotsSubscriberClass()
        const context = createContext(false)
        const subscribe = vi.spyOn(StoreEventsSubscriberHandler.prototype, 'subscribe')
        new PluginSubscription([subscriber]).plugin(context)
        expect(context.store.$rollbackAfterFailure).toBeTypeOf('function')
        expect(subscribe).toHaveBeenCalledOnce()
        subscribe.mockRestore()
    })

    it('registers the store event subscriber', () => {
        const subscriber = new StateSnapshotsSubscriberClass()
        const context = createContext()
        const subscribe = vi.spyOn(StoreEventsSubscriberHandler.prototype, 'subscribe')

        new PluginSubscription([subscriber]).plugin(context)
        expect(subscribe).toHaveBeenCalledOnce()
        expect(subscribe).toHaveBeenCalledWith(context.store.$id, expect.objectContaining({ id: expect.any(String) }))
        expect(context.store.$rollbackAfterFailure).toBeTypeOf('function')
        subscribe.mockRestore()
    })

    it('reports missing plugin options when event registration is required', () => {
        const subscriber = new StateSnapshotsSubscriberClass()
        const context = createContext()

        expect(() => subscriber.invoke(context)).toThrow('State snapshots require plugin options with an events handler')

        const subscribe = vi.spyOn(StoreEventsSubscriberHandler.prototype, 'subscribe')
        new PluginSubscription([subscriber]).plugin(context)
        expect(subscribe).toHaveBeenCalledOnce()
        subscribe.mockRestore()
    })
})

describe('state reset', () => {
    it('restores the initial state before running registered reset callbacks', () => {
        const context = createContext(false)
        const observedCounts: number[] = []
        const firstResetCallback = vi.fn((store?: PiniaPluginContext['store']) => {
            observedCounts.push(store?.count)
        })
        const secondResetCallback = vi.fn((store?: PiniaPluginContext['store']) => {
            observedCounts.push(store?.count)
        })
        context.options.storeOptions = { overrideReset: true }
        const originalReset = context.store.$reset
        const plugin = new PluginSubscription([new StateSnapshotsSubscriberClass()])

        plugin.plugin(context)
        expect(context.store.$onResetStore).toBeTypeOf('function')
        context.store.$onResetStore?.(firstResetCallback)
        context.store.$onResetStore?.(secondResetCallback)
        expect(context.store.$reset).not.toBe(originalReset)
        context.store.count = 5
        context.store.$reset()

        expect(context.store.count).toBe(0)
        expect(firstResetCallback).toHaveBeenCalledWith(context.store)
        expect(secondResetCallback).toHaveBeenCalledWith(context.store)
        expect(observedCounts).toEqual([0, 0])
    })

    it('does not install reset wrapping just because a callback is registered', () => {
        const context = createContext(false)
        const resetCallback = vi.fn()
        const originalReset = context.store.$reset
        const plugin = new PluginSubscription([new StateSnapshotsSubscriberClass()])

        plugin.plugin(context)
        context.store.$onResetStore?.(resetCallback)
        expect(context.store.$reset).toBe(originalReset)

        context.store.count = 5
        context.store.$reset()

        expect(resetCallback).not.toHaveBeenCalled()
    })

    it('clones structured values when resetting the store', () => {
        const context = createContext(false)
        const initialMap = new Map([['first', { nested: 1 }]])
        const initialSet = new Set([{ nested: 2 }, 'ready'])
        context.store.$state.records = initialMap
        context.store.$state.tags = initialSet
        const stateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()
        stateSnapshotsSubscriber.overrideReset = true
        const plugin = new PluginSubscription([stateSnapshotsSubscriber])

        plugin.plugin(context)
        context.store.$state.records = new Map()
        context.store.$state.tags = new Set()
        context.store.$reset()

        expect(context.store.$state.records).not.toBe(initialMap)
        expect(context.store.$state.tags).not.toBe(initialSet)
        expect(context.store.$state.records.get('first')).toEqual({ nested: 1 })
        expect(context.store.$state.tags.has('ready')).toBe(true)
    })
})

describe('rollback action', () => {
    it('restores state and propagates an action failure', async () => {
        const { store } = createContext()
        new RollbackStateSnapshotsHandler().addRollbackAction(store)

        await expect(store.$rollbackAfterFailure({ action: 'fail' })).rejects.toThrow('action failed')
        expect(store.$state.count).toBe(0)
    })

    function deferred() {
        let resolve!: () => void
        const promise = new Promise<void>(done => { resolve = done })
        return { promise, resolve }
    }

    function setupAutomaticRollback() {
        const pinia = createPinia()
        const useStore = defineStore('automatic-snapshots-test', {
            state: () => ({ count: 0 }),
            actions: {
                async update(value: number, gate: Promise<void>, fail: boolean) {
                    this.count = value
                    await gate
                    if (fail) {
                        throw new Error('update failed')
                    }
                },
                succeed() {
                    this.count++
                },
                nested(depth: number) {
                    this.count++
                    if (depth > 0) {
                        try {
                            this.nested(depth - 1)
                        } catch {
                            if (this.count !== 1) {
                                throw new Error('inner snapshot was not restored')
                            }
                        }
                    }
                    throw new Error('nested failed')
                }
            }
        })
        const store = useStore(pinia)
        const subscriber = new StateSnapshotsSubscriberClass()
        const context: PiniaPluginContext = {
            app: createApp({}),
            pinia,
            store,
            options: { actions: {}, storeOptions: { rollbackAfterFailure: { update: 'all', nested: 'all', succeed: 'all' } } }
        }
        const plugin = new PluginSubscription([subscriber])
        plugin.plugin(context)
        const handler = Reflect.get(subscriber, '_rollbackStateSnapshotsHandler')
        const snapshots: Map<symbol, unknown> = Reflect.get(handler, '_stateSnapshots')
        return { context, plugin, snapshots, store, useStore, pinia }
    }

    describe('automatic rollback', () => {
        it('keeps independent snapshots for concurrent calls that fail out of order', async () => {
            const { store, snapshots } = setupAutomaticRollback()
            const patch = vi.spyOn(store, '$patch')
            const first = deferred()
            const second = deferred()
            const firstResult = store.update(1, first.promise, true)
            const secondResult = store.update(2, second.promise, true)
            const firstFailure = expect(firstResult).rejects.toThrow('update failed')
            const secondFailure = expect(secondResult).rejects.toThrow('update failed')

            expect(snapshots.size).toBe(2)
            second.resolve()
            await secondFailure
            expect(store.count).toBe(1)
            expect(snapshots.size).toBe(1)
            first.resolve()
            await firstFailure
            expect(store.count).toBe(0)
            expect(snapshots.size).toBe(0)
            expect(patch).toHaveBeenCalledTimes(2)
        })

        it('removes only the successful invocation snapshot', async () => {
            const { store, snapshots } = setupAutomaticRollback()
            const first = deferred()
            const second = deferred()
            const failed = store.update(1, first.promise, true)
            const failure = expect(failed).rejects.toThrow('update failed')
            const succeeded = store.update(2, second.promise, false)

            second.resolve()
            await succeeded
            expect(store.count).toBe(2)
            expect(snapshots.size).toBe(1)
            first.resolve()
            await failure
            expect(store.count).toBe(0)
            expect(snapshots.size).toBe(0)
        })

        it('restores nested calls of the same action independently', () => {
            const { store, snapshots } = setupAutomaticRollback()

            expect(() => store.nested(1)).toThrow('nested failed')
            expect(store.count).toBe(0)
            expect(snapshots.size).toBe(0)
        })

        it('restores a synchronous failure once', () => {
            const { store, snapshots } = setupAutomaticRollback()
            const patch = vi.spyOn(store, '$patch')

            expect(() => store.nested(0)).toThrow('nested failed')
            expect(store.count).toBe(0)
            expect(snapshots.size).toBe(0)
            expect(patch).toHaveBeenCalledOnce()
        })

        it('cleans up a successful synchronous invocation', () => {
            const { store, snapshots } = setupAutomaticRollback()
            store.succeed()
            expect(snapshots.size).toBe(0)
            expect(store.count).toBe(1)
        })

        it('clears pending snapshots on disposal and supports a recreated store', async () => {
            const { store, snapshots, plugin, context, useStore, pinia } = setupAutomaticRollback()
            const gate = deferred()
            const pending = store.update(1, gate.promise, true)
            const failure = expect(pending).rejects.toThrow('update failed')
            expect(snapshots.size).toBe(1)

            store.$dispose()
            expect(snapshots.size).toBe(0)
            const recreated = useStore(pinia)
            plugin.plugin({ ...context, store: recreated })
            const second = deferred()
            const secondResult = recreated.update(2, second.promise, true)
            const secondFailure = expect(secondResult).rejects.toThrow('update failed')
            expect(snapshots.size).toBe(1)
            gate.resolve()
            await failure
            expect(snapshots.size).toBe(1)
            second.resolve()
            await secondFailure
            expect(recreated.count).toBe(1)
            expect(snapshots.size).toBe(0)
        })
    })

    describe('store action events', () => {
        it.each([false, true])('emits completion events when actions settle (action callback: %s)', async (withActionCallback) => {
            const { store, context } = setupAutomaticRollback()
            store.$dispose()
            const pinia = createPinia()
            const useStore = defineStore('event-timing-test', {
                actions: {
                    async run(gate: Promise<void>, fail: boolean) {
                        await gate
                        if (fail) throw new Error('event failure')
                    }
                }
            })

            const eventStore = useStore(pinia)
            const events: Array<[string, symbol]> = []
            const subscriber: PluginSubscriberInterface = {
                name: 'events',
                invoke({ store }, options) {
                    if (!options) throw new Error('missing event handler')
                    options.eventsHandler.subscribe(store.$id, new StoreEventsSubscriber('events', store, {
                        [STORE_EVENTS.ACTION_BEFORE]: (_name, key) => events.push(['before', key]),
                        [STORE_EVENTS.ACTION_AFTER]: (_name, key) => events.push(['after', key]),
                        [STORE_EVENTS.ACTION_ON_ERROR]: (_name, _error, key) => events.push(['error', key])
                    }))
                    return true
                }
            }
            const actionCallback = vi.fn()
            const actionSubscriber: PluginSubscriberInterface = {
                name: 'action-listener',
                invoke: () => true,
                storeOnActionSubscription: () => ({ store: eventStore, callback: actionCallback })
            }
            new PluginSubscription(withActionCallback ? [subscriber, actionSubscriber] : [subscriber])
                .plugin({ ...context, pinia, store: eventStore, options: { actions: {} } })
            const first = deferred()
            const second = deferred()
            const success = eventStore.run(first.promise, false)
            const failed = eventStore.run(second.promise, true)
            const failure = expect(failed).rejects.toThrow('event failure')

            expect(actionCallback).toHaveBeenCalledTimes(withActionCallback ? 2 : 0)
            expect(events.map(([event]) => event)).toEqual(['before', 'before'])
            expect(events[0]![1]).not.toBe(events[1]![1])
            first.resolve()
            await success
            second.resolve()
            await failure
            expect(events).toEqual([
                ['before', events[0]![1]], ['before', events[1]![1]],
                ['after', events[0]![1]], ['error', events[1]![1]]
            ])
        })

        it('wires action events when the subscriber is deferred', () => {
            const pinia = createPinia()
            const useStore = defineStore('deferred-events-test', { actions: { run() { return 1 } } })
            const store = useStore(pinia)
            const scheduled: Array<() => void> = []
            const before = vi.fn()
            const subscriber: PluginSubscriberInterface = {
                name: 'deferred-events',
                execution: { environment: 'client', hydration: 'defer' },
                invoke({ store }, options) {
                    if (!options) throw new Error('missing event handler')
                    options.eventsHandler.subscribe(store.$id, new StoreEventsSubscriber('events', store, {
                        [STORE_EVENTS.ACTION_BEFORE]: before
                    }))
                    return true
                }
            }
            new PluginSubscription([subscriber], {
                runtimeEnvironment: 'client',
                hydrationScheduler: callback => scheduled.push(callback)
            }).plugin({ app: createApp({}), pinia, store, options: { actions: {} } })

            store.run()
            expect(before).not.toHaveBeenCalled()
            scheduled[0]!()
            store.run()
            expect(before).toHaveBeenCalledOnce()
        })
    })

})
