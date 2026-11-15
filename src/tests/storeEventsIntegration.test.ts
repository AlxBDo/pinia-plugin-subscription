import { createPinia, defineStore } from 'pinia'
import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import PluginSubscriber from '../core/PluginSubscriber'
import PluginSubscription from '../core/PluginSubscription'
import Store from '../core/Store'
import { STORE } from '../dictionaries/plugin-subscription-event'
import StoreEventsSubscriber from '../events/store-events-subscriber'

import type { Store as PiniaStore } from 'pinia'
import type { StoreClassConstructorParams } from '../types/plugin'

describe('Store event subscriptions', () => {
    it('calls every store disposal hook with its instance before clearing subscriptions', () => {
        const pinia = createPinia()
        const store = defineStore('dispose-hooks', {})(pinia)
        const hooks: string[] = []

        class DisposableStore extends Store {
            protected static override _requiredKeysValidation: false = false
            protected override onDispose() {
                hooks.push(this.store.$id)
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

    it('receives action events registered by a Store and clears subscribers on disposal', () => {
        const pinia = createPinia()
        const store = defineStore('store-event-integration', {
            actions: {
                succeed() { return 42 },
                fail() { throw new Error('action failed') }
            }
        })(pinia)
        const before = vi.fn()
        const after = vi.fn()
        const onError = vi.fn()
        const secondBefore = vi.fn()
        let eventSubscriber: StoreEventsSubscriber | undefined

        class EventStore extends Store {
            constructor(piniaStore: PiniaStore, options: StoreClassConstructorParams) {
                super(piniaStore, options)
                this.addEventStoreSubscription('action-events', piniaStore, {
                    [STORE.ACTION_BEFORE]: before,
                    [STORE.ACTION_AFTER]: after,
                    [STORE.ACTION_ON_ERROR]: onError
                })
                eventSubscriber = new StoreEventsSubscriber('disposal', piniaStore, {
                    [STORE.ACTION_BEFORE]: secondBefore
                })
                this.addEventStoreSubscriber(eventSubscriber)
            }
        }

        class EventPlugin extends PluginSubscriber<EventStore> {
            protected _name = 'event-plugin'
            constructor() {
                super((piniaStore, options) => new EventStore(piniaStore, options))
            }
        }

        new PluginSubscription([new EventPlugin()]).plugin({
            app: createApp({}), pinia, store, options: { actions: {} }
        })

        expect(store.succeed()).toBe(42)
        expect(() => store.fail()).toThrow('action failed')
        expect(before).toHaveBeenCalledTimes(2)
        expect(secondBefore).toHaveBeenCalledTimes(2)
        const successKey = before.mock.calls[0]![1]
        const failureKey = before.mock.calls[1]![1]
        expect(typeof successKey).toBe('symbol')
        expect(typeof failureKey).toBe('symbol')
        expect(successKey).not.toBe(failureKey)
        expect(after).toHaveBeenCalledWith('succeed', successKey)
        expect(onError).toHaveBeenCalledWith('fail', expect.objectContaining({ message: 'action failed' }), failureKey)
        expect(eventSubscriber?.id).toBe('disposal')

        store.$dispose()
        expect(eventSubscriber?.id).toBeUndefined()
        expect(eventSubscriber?.storeId).toBeUndefined()
        expect(eventSubscriber?.subscriptions).toEqual({})
        store.succeed()
        expect(before).toHaveBeenCalledTimes(2)
        expect(secondBefore).toHaveBeenCalledTimes(2)
        expect(after).toHaveBeenCalledOnce()
    })
})
