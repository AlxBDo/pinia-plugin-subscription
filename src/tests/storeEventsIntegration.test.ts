import { createPinia, defineStore } from 'pinia'
import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import PluginSubscriber from '../core/PluginSubscriber'
import PluginSubscription from '../core/PluginSubscription'
import Store from '../core/Store'
import { STORE } from '../dictionaries/plugin-subscription-event'

import type { PiniaPluginContext, Store as PiniaStore } from 'pinia'
import type { PluginOptions, StoreClassConstructorParams } from '../types/plugin'

describe('Store event subscriptions', () => {
    it('calls every store disposal hook with its instance before clearing subscriptions', () => {
        const pinia = createPinia()
        const store = defineStore('dispose-hooks', {})(pinia)
        const hooks: string[] = []

        class DisposableStore extends Store {
            protected static override _requiredKeysValidation: false = false

            constructor(piniaStore: PiniaStore, options: StoreClassConstructorParams) {
                super(piniaStore, options)
                this.onDispose(store => hooks.push(store.$id))
            }
        }
        class FirstPlugin extends PluginSubscriber<DisposableStore> {
            protected _name = 'first'
            constructor() { super(DisposableStore.customizeStore.bind(DisposableStore)) }
        }
        class SecondPlugin extends PluginSubscriber<DisposableStore> {
            protected _name = 'second'
            constructor() { super(DisposableStore.customizeStore.bind(DisposableStore)) }
        }
        new PluginSubscription([new FirstPlugin(), new SecondPlugin()]).plugin({
            app: createApp({}), pinia, store, options: { actions: {}, storeOptions: {} }
        })

        store.$dispose()
        expect(hooks).toEqual(['dispose-hooks', 'dispose-hooks'])
    })

    it('isolates events and disposal for store instances with the same id', () => {
        const useStore = defineStore('shared-id', {
            actions: { run() { return 42 } }
        })
        const firstPinia = createPinia()
        const secondPinia = createPinia()
        const firstStore = useStore(firstPinia)
        const secondStore = useStore(secondPinia)
        const firstEvents = vi.fn()
        const secondEvents = vi.fn()
        const firstDispose = vi.fn()
        const secondDispose = vi.fn()

        class EventStore extends Store {
            protected static override _requiredKeysValidation: false = false

            protected override init(): void {
                const events = this._store === firstStore ? firstEvents : secondEvents
                const dispose = this._store === firstStore ? firstDispose : secondDispose
                this.addEventSubscription(STORE.ACTION_BEFORE, events)
                this.onDispose(dispose)
            }
        }

        class ScopedPlugin extends PluginSubscriber<EventStore> {
            protected _name: string

            constructor(name: string, private readonly target: PiniaStore) {
                super(EventStore.customizeStore.bind(EventStore))
                this._name = name
            }

            public override invoke(context: PiniaPluginContext, options?: PluginOptions): boolean {
                return context.store === this.target && super.invoke(context, options)
            }
        }

        const plugin = new PluginSubscription([
            new ScopedPlugin('first-plugin', firstStore),
            new ScopedPlugin('second-plugin', secondStore)
        ])
        const app = createApp({})
        plugin.plugin({ app, pinia: firstPinia, store: firstStore, options: { actions: {}, storeOptions: {} } })
        plugin.plugin({ app, pinia: secondPinia, store: secondStore, options: { actions: {}, storeOptions: {} } })

        try {
            firstStore.run()
            expect.soft(firstEvents).toHaveBeenCalledTimes(1)
            expect.soft(secondEvents).not.toHaveBeenCalled()
            firstEvents.mockClear()
            secondEvents.mockClear()

            firstStore.$dispose()
            expect.soft(firstDispose).toHaveBeenCalledOnce()
            expect.soft(secondDispose).not.toHaveBeenCalled()

            secondStore.run()
            expect.soft(secondEvents).toHaveBeenCalledTimes(1)
            expect.soft(firstEvents).not.toHaveBeenCalled()
        } finally {
            secondStore.$dispose()
        }
    })

    it('receives action events registered by a Store and clears subscribers on disposal', () => {
        const pinia = createPinia()
        const store = defineStore('store-event-integration', {
            actions: {
                succeed(_value: string) { return 42 },
                fail(_value: string) { throw new Error('action failed') }
            }
        })(pinia)
        const before = vi.fn()
        const after = vi.fn()
        const onError = vi.fn()
        const secondBefore = vi.fn()

        class EventStore extends Store {
            protected static override _requiredKeysValidation: false = false

            protected override init(): void {
                this.addEventSubscription(STORE.ACTION_BEFORE, event => {
                    before(event.payload?.())
                })
                this.addEventSubscription(STORE.ACTION_BEFORE, event => {
                    secondBefore(event.payload?.())
                })
                this.addEventSubscription(STORE.ACTION_AFTER, event => {
                    after(event.payload?.())
                })
                this.addEventSubscription(STORE.ACTION_ON_ERROR, event => {
                    onError(event.payload?.())
                })
            }
        }

        class EventPlugin extends PluginSubscriber<EventStore> {
            protected _name = 'event-plugin'
            constructor() {
                super(EventStore.customizeStore.bind(EventStore))
            }
        }

        new PluginSubscription([new EventPlugin()]).plugin({
            app: createApp({}), pinia, store, options: { actions: {}, storeOptions: {} }
        })

        expect(store.succeed('success')).toBe(42)
        expect(() => store.fail('failure')).toThrow('action failed')
        expect(before).toHaveBeenCalledTimes(2)
        expect(secondBefore).toHaveBeenCalledTimes(2)
        const successKey = before.mock.calls[0]![0].invocationKey
        const failureKey = before.mock.calls[1]![0].invocationKey
        expect(typeof successKey).toBe('symbol')
        expect(typeof failureKey).toBe('symbol')
        expect(successKey).not.toBe(failureKey)
        expect(before.mock.calls.map(([payload]) => payload)).toEqual([
            { action: 'succeed', args: ['success'], invocationKey: successKey },
            { action: 'fail', args: ['failure'], invocationKey: failureKey }
        ])
        expect(secondBefore.mock.calls).toEqual(before.mock.calls)
        expect(after).toHaveBeenCalledWith({ action: 'succeed', result: 42, invocationKey: successKey })
        expect(onError).toHaveBeenCalledWith({
            action: 'fail',
            error: expect.objectContaining({ message: 'action failed' }),
            invocationKey: failureKey
        })

        store.$dispose()
        store.succeed('after disposal')
        expect(before).toHaveBeenCalledTimes(2)
        expect(secondBefore).toHaveBeenCalledTimes(2)
        expect(after).toHaveBeenCalledOnce()
    })
})
