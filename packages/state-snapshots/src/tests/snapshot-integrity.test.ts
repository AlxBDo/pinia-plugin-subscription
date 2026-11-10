import { createApp, effect, ref, toRaw } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginSubscription, STORE_EVENTS, StoreEventsSubscriber } from 'pinia-plugin-subscription/helpers'
import { createStateSnapshot, restoreStateSnapshot } from '../factories/state-snapshot'
import { StateSnapshotsSubscriberClass } from '../plugin/state-snapshots-subscriber'

import type { PiniaPluginContext, StateTree } from 'pinia'
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/types'

function install(store: PiniaPluginContext['store'], pinia: PiniaPluginContext['pinia'], keys: string[] | 'all' = 'all') {
    const subscriber = new StateSnapshotsSubscriberClass()
    const plugin = new PluginSubscription([subscriber])
    plugin.plugin({
        app: createApp({}),
        pinia,
        store,
        options: { actions: {}, storeOptions: { rollbackAfterFailure: { fail: keys } } }
    })
    return subscriber
}

describe('snapshot integrity', () => {
    afterEach(() => vi.restoreAllMocks())

    it('snapshots observed setup-store refs without cloning Vue internals', () => {
        const pinia = createPinia()
        const store = defineStore('observed', () => {
            const count = ref(1)
            const text = ref('before')
            function fail() {
                count.value++
                text.value = 'after'
                throw new Error('action failed')
            }
            return { count, text, fail }
        })(pinia)
        install(store, pinia)
        const stop = effect(() => store.count)

        expect(() => store.fail()).toThrow('action failed')
        expect(store.count).toBe(1)
        expect(store.text).toBe('before')
        stop.effect.stop()
    })

    it('restores cycles, shared values, maps, sets, dates, URLs and bigints', () => {
        const shared: StateTree = { value: 1n }
        shared.self = shared
        const state: StateTree = {
            first: shared,
            second: shared,
            map: new Map([[shared, shared]]),
            set: new Set([shared]),
            date: new Date('2024-01-01T00:00:00Z'),
            url: new URL('https://example.com/a')
        }
        state.root = state
        const snapshot = createStateSnapshot(state)
        state.first = { changed: true }
        state.second.value = 2n
        state.map.clear()
        state.set.clear()
        state.date.setUTCFullYear(2030)
        state.url.pathname = '/b'
        state.added = true
        Object.defineProperty(state, 'hidden', { value: 1, configurable: true })
        const symbol = Symbol('added')
        state[symbol] = true
        delete state.root
        restoreStateSnapshot(state, snapshot)

        expect(state.first).toBe(state.second)
        expect(state.first.self).toBe(state.first)
        expect(state.first.value).toBe(1n)
        expect(state.root).toBe(state)
        expect([...state.map.entries()]).toEqual([[state.first, state.first]])
        expect([...state.set]).toEqual([state.first])
        expect(state.date.toISOString()).toBe('2024-01-01T00:00:00.000Z')
        expect(state.url.href).toBe('https://example.com/a')
        expect(state).not.toHaveProperty('added')
        expect(state).not.toHaveProperty('hidden')
        expect(state[symbol]).toBeUndefined()
    })

    it('registers rollback and restores cyclic reactive state in a real Pinia store', () => {
        const pinia = createPinia()
        const store = defineStore('cyclic-store', {
            state: () => {
                const shared: StateTree = { count: 1 }
                shared.self = shared
                return { first: shared, second: shared }
            },
            actions: {
                fail() {
                    this.first.count = 2
                    throw new Error('action failed')
                }
            }
        })(pinia)
        install(store, pinia)
        expect(() => store.fail()).toThrow('action failed')
        expect(store.first.count).toBe(1)
        expect(store.first).toBe(store.second)
        expect(store.first.self).toBe(store.first)
    })

    it('isolates stores with the same id in different Pinia instances', () => {
        const subscriber = new StateSnapshotsSubscriberClass()
        const useStore = defineStore('shared-id', {
            state: () => ({ count: 0 }),
            actions: { fail() { this.count++; throw new Error('action failed') } }
        })
        const firstPinia = createPinia()
        const secondPinia = createPinia()
        const first = useStore(firstPinia)
        const second = useStore(secondPinia)
        for (const [pinia, store] of [[firstPinia, first], [secondPinia, second]] as const) {
            new PluginSubscription([subscriber]).plugin({
                app: createApp({}), pinia, store,
                options: { actions: {}, storeOptions: { rollbackAfterFailure: { fail: 'all' } } }
            })
        }
        expect(() => first.fail()).toThrow('action failed')
        first.$dispose()
        expect(() => second.fail()).toThrow('action failed')
        expect(second.count).toBe(0)
    })

    it('cleans up a pending manual snapshot when an unconfigured store is disposed', async () => {
        const pinia = createPinia()
        let release!: () => void
        const gate = new Promise<void>(resolve => { release = resolve })
        const store = defineStore('manual-dispose', {
            state: () => ({ count: 0 }),
            actions: {
                async fail() {
                    this.count = 1
                    await gate
                    throw new Error('action failed')
                }
            }
        })(pinia)
        const subscriber = new StateSnapshotsSubscriberClass()
        new PluginSubscription([subscriber]).plugin({ app: createApp({}), pinia, store, options: { actions: {} } })
        const pending = store.$rollbackAfterFailure({ action: 'fail' })
        const failure = expect(pending).rejects.toThrow('action failed')
        const handler = Reflect.get(subscriber, '_rollbackStateSnapshotsHandler')
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(1)
        store.$dispose()
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(0)
        release()
        await failure
        expect(store.count).toBe(1)
    })

    it('restores full state exactly through Pinia without touching external references', () => {
        const pinia = createPinia()
        const store = defineStore('full-restore', {
            state: () => ({ nested: { existing: 1 }, other: 2 }),
            actions: {
                fail() {
                    Object.assign(this.nested, { added: 5 })
                    delete (this.$state as StateTree).other
                        ; (this.$state as StateTree).added = 10
                    throw new Error('action failed')
                }
            }
        })(pinia)
        install(store, pinia)
        const previous = store.nested

        expect(() => store.fail()).toThrow('action failed')
        expect(store.$state).toEqual({ nested: { existing: 1 }, other: 2 })
        expect(store.nested).not.toBe(previous)
    })

    it('reattaches a deleted setup-store ref so actions remain connected to state', () => {
        const pinia = createPinia()
        const useStore = defineStore('deleted-ref', () => {
            const count = ref(1)
            function increment() { count.value++ }
            function fail() {
                delete (store.$state as StateTree).count
                count.value = 9
                throw new Error('action failed')
            }
            return { count, increment, fail }
        })
        const store = useStore(pinia)
        install(store, pinia)
        expect(() => store.fail()).toThrow('action failed')
        expect(store.count).toBe(1)
        expect(store.$state.count).toBe(1)
        store.increment()
        expect(store.$state.count).toBe(2)
    })

    it('restores only selected keys, including keys absent before the action', () => {
        const pinia = createPinia()
        const store = defineStore('partial-restore', {
            state: () => ({ selected: { x: 1 }, unselected: 1 }),
            actions: {
                fail() {
                    this.selected.x = 2
                    this.unselected = 2
                        ; (this.$state as StateTree).missing = 1
                    throw new Error('action failed')
                }
            }
        })(pinia)
        install(store, pinia, ['selected', 'missing'])
        expect(() => store.fail()).toThrow('action failed')
        expect(store.$state).toEqual({ selected: { x: 1 }, unselected: 2 })
    })

    it.each([
        ['function', () => () => 1],
        ['symbol', () => Symbol('x')],
        ['class instance', () => new (class Example { })()],
        ['regular expression', () => /x/],
        ['array buffer', () => new ArrayBuffer(4)]
    ])('reports unsupported %s and executes automatic and manual actions', async (_label, unsupported) => {
        const pinia = createPinia()
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const action = vi.fn(() => 'completed')
        const store = defineStore(`unsupported-${_label}`, {
            state: () => ({ value: unsupported() }),
            actions: {
                fail() { return action() },
                manual() { return action() }
            }
        })(pinia)
        const subscriber = install(store, pinia)
        expect(store.fail()).toBe('completed')
        await expect(store.$rollbackAfterFailure({ action: 'manual' })).resolves.toBeUndefined()
        expect(action).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining(`action 'fail' in store 'unsupported-${_label}'`),
            expect.objectContaining({ message: expect.stringMatching(/Unsupported snapshot/) })
        )
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining(`action 'manual' in store 'unsupported-${_label}'`),
            expect.objectContaining({ message: expect.stringMatching(/Unsupported snapshot/) })
        )
        const handler = Reflect.get(subscriber, '_rollbackStateSnapshotsHandler')
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(0)
    })

    it('logs invalid snapshot keys and executes the action', () => {
        const pinia = createPinia()
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const action = vi.fn()
        const store = defineStore('invalid-keys', { actions: { fail() { action() } } })(pinia)
        const options: PiniaPluginContext['options'] = {
            actions: {}, storeOptions: { rollbackAfterFailure: { fail: [] } }
        }
        Reflect.set(options.storeOptions!.rollbackAfterFailure!, 'fail', null)
        new PluginSubscription([new StateSnapshotsSubscriberClass()]).plugin({
            app: createApp({}), pinia, store, options
        })
        store.fail()
        expect(action).toHaveBeenCalledOnce()
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining("action 'fail' in store 'invalid-keys'"),
            expect.objectContaining({ message: expect.stringContaining('Invalid snapshot keys') })
        )
    })

    it('runs an asynchronous manual action with arguments when snapshot keys are invalid', async () => {
        const pinia = createPinia()
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const store = defineStore('invalid-manual-keys', {
            state: () => ({ count: 0 }),
            actions: {
                async update(amount: number) {
                    await Promise.resolve()
                    this.count += amount
                }
            }
        })(pinia)
        const subscriber = new StateSnapshotsSubscriberClass()
        new PluginSubscription([subscriber]).plugin({ app: createApp({}), pinia, store, options: { actions: {} } })
        const params = { action: 'update', stateKeys: ['count'] }
        Reflect.set(params, 'stateKeys', null)

        await expect(store.$rollbackAfterFailure(params, [3])).resolves.toBeUndefined()
        expect(store.count).toBe(3)
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining("action 'update' in store 'invalid-manual-keys'"),
            expect.objectContaining({ message: expect.stringContaining('Invalid snapshot keys') })
        )
    })

    it.each(['automatic', 'manual'] as const)(
        'preserves synchronous and asynchronous action failures without a %s snapshot',
        async mode => {
            const pinia = createPinia()
            const log = vi.spyOn(console, 'error').mockImplementation(() => { })
            const failure = new Error('action failed')
            const store = defineStore(`capture-failure-${mode}`, {
                state: () => ({ count: 0, unsupported: /unsupported/ }),
                actions: {
                    syncFail() { this.count++; throw failure },
                    async asyncFail() { this.count++; await Promise.resolve(); throw failure }
                }
            })(pinia)
            const subscriber = new StateSnapshotsSubscriberClass()
            const rollbackAfterFailure = mode === 'automatic'
                ? { syncFail: 'all' as const, asyncFail: 'all' as const }
                : undefined
            new PluginSubscription([subscriber]).plugin({
                app: createApp({}), pinia, store,
                options: { actions: {}, storeOptions: { rollbackAfterFailure } }
            })
            const patch = vi.spyOn(store, '$patch')

            if (mode === 'automatic') {
                expect(() => store.syncFail()).toThrow(failure)
                await expect(store.asyncFail()).rejects.toBe(failure)
            } else {
                await expect(store.$rollbackAfterFailure({ action: 'syncFail' })).rejects.toBe(failure)
                await expect(store.$rollbackAfterFailure({ action: 'asyncFail' })).rejects.toBe(failure)
            }
            expect(store.count).toBe(2)
            expect(patch).not.toHaveBeenCalled()
            expect(log).toHaveBeenCalledTimes(2)
            expect(log).toHaveBeenCalledWith(
                expect.stringContaining(`action 'syncFail' in store 'capture-failure-${mode}'`),
                expect.objectContaining({ message: expect.stringContaining('Unsupported snapshot') })
            )
            expect(log).toHaveBeenCalledWith(
                expect.stringContaining(`action 'asyncFail' in store 'capture-failure-${mode}'`),
                expect.objectContaining({ message: expect.stringContaining('Unsupported snapshot') })
            )
            const handler = Reflect.get(subscriber, '_rollbackStateSnapshotsHandler')
            expect(Reflect.get(handler, '_stateSnapshots').size).toBe(0)
        }
    )

    it('keeps independently captured snapshots when another invocation cannot capture', async () => {
        const pinia = createPinia()
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        let release!: () => void
        const gate = new Promise<void>(resolve => { release = resolve })
        const store = defineStore('mixed-snapshots', {
            state: (): StateTree => ({ count: 0, value: 'supported' }),
            actions: {
                async fail() {
                    this.count++
                    await gate
                    throw new Error('action failed')
                }
            }
        })(pinia)
        const subscriber = install(store, pinia)
        const first = store.fail()
        const firstFailure = expect(first).rejects.toThrow('action failed')
        store.value = /unsupported/
        const second = store.fail()
        const secondFailure = expect(second).rejects.toThrow('action failed')
        const handler = Reflect.get(subscriber, '_rollbackStateSnapshotsHandler')
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(1)
        expect(log).toHaveBeenCalledOnce()
        release()
        await Promise.all([firstFailure, secondFailure])
        expect(store.count).toBe(0)
        expect(store.value).toBe('supported')
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(0)
    })

    it('reports restoration failure and the original action error for synchronous and async actions', async () => {
        const pinia = createPinia()
        const original = new Error('original action error')
        const restoreFailure = new Error('restore failed')
        const store = defineStore('restore-failure', {
            state: () => ({ count: 0 }),
            actions: {
                fail() { throw original },
                async asyncFail() { throw original }
            }
        })(pinia)
        const plugin = new PluginSubscription([new StateSnapshotsSubscriberClass()])
        plugin.plugin({
            app: createApp({}), pinia, store,
            options: { actions: {}, storeOptions: { rollbackAfterFailure: { fail: 'all', asyncFail: 'all' } } }
        })
        vi.spyOn(store, '$patch').mockImplementation(() => { throw restoreFailure })
        try {
            store.fail()
            throw new Error('expected failure')
        } catch (error) {
            expect(error).toBeInstanceOf(AggregateError)
            expect((error as AggregateError).errors).toEqual([original, restoreFailure])
        }
        await expect(store.asyncFail()).rejects.toMatchObject({ errors: [original, restoreFailure] })
        await expect(store.$rollbackAfterFailure({ action: 'fail' })).rejects.toBeInstanceOf(AggregateError)
    })

    it('cleans up snapshots from other subscribers when a critical before event fails', () => {
        const pinia = createPinia()
        const store = defineStore('critical-before', {
            state: () => ({ count: 0 }),
            actions: { fail() { this.count++ } }
        })(pinia)
        const snapshots = new StateSnapshotsSubscriberClass()
        class CriticalSubscriber extends StoreEventsSubscriber {
            shouldPropagateError(event: string) { return event === STORE_EVENTS.ACTION_BEFORE }
        }
        const critical: PluginSubscriberInterface = {
            name: 'critical',
            invoke(context, options) {
                if (!options) throw new Error('missing options')
                options.eventsHandler.subscribe(context.store.$id, new CriticalSubscriber('critical', context.store, {
                    [STORE_EVENTS.ACTION_BEFORE]: () => { throw new Error('before failed') }
                }))
                return true
            }
        }
        new PluginSubscription([snapshots, critical]).plugin({
            app: createApp({}), pinia, store,
            options: { actions: {}, storeOptions: { rollbackAfterFailure: { fail: 'all' } } }
        })
        expect(() => store.fail()).toThrow('before failed')
        expect(store.count).toBe(0)
        const handler = Reflect.get(snapshots, '_rollbackStateSnapshotsHandler')
        expect(Reflect.get(handler, '_stateSnapshots').size).toBe(0)
    })

    it('preserves both a before-action failure and a cleanup failure', () => {
        const pinia = createPinia()
        const store = defineStore('critical-cleanup', { actions: { fail() { } } })(pinia)
        const beforeFailure = new Error('before failed')
        const cleanupFailure = new Error('cleanup failed')
        class CriticalSubscriber extends StoreEventsSubscriber {
            shouldPropagateError() { return true }
        }
        const subscriber: PluginSubscriberInterface = {
            name: 'critical',
            invoke(context, options) {
                if (!options) throw new Error('missing options')
                options.eventsHandler.subscribe(context.store.$id, new CriticalSubscriber('critical', context.store, {
                    [STORE_EVENTS.ACTION_BEFORE]: () => { throw beforeFailure },
                    [STORE_EVENTS.ACTION_ERROR]: () => { throw cleanupFailure }
                }))
                return true
            }
        }
        new PluginSubscription([subscriber]).plugin({ app: createApp({}), pinia, store, options: { actions: {} } })
        try {
            store.fail()
            throw new Error('expected failure')
        } catch (error) {
            expect(error).toBeInstanceOf(AggregateError)
            expect((error as AggregateError).errors).toEqual([beforeFailure, cleanupFailure])
        }
    })

    it('preserves selected values when they contain nested reactive proxies', () => {
        const original = ref({ items: [{ count: 1 }] })
        const state = { value: original.value }
        const snapshot = createStateSnapshot(state)
        original.value.items[0]!.count = 9
        restoreStateSnapshot(state, snapshot)
        expect(toRaw(state.value).items[0]!.count).toBe(1)
    })
})
