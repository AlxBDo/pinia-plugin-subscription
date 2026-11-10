import { createPinia, defineStore, type Store } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import StoreEventsSubscriber from '../events/store-events-subscriber'

class TestStoreEventsSubscriber extends StoreEventsSubscriber {
    public unsubscribeEvent(event: string) {
        this.unsubscribe(event)
    }
}

function createStore(id: string): Store {
    return defineStore(id, {})(createPinia())
}

describe('StoreEventsSubscriber', () => {
    it('exposes its id and the subscriptions provided at construction', () => {
        const store = createStore('store-a')
        const handler = vi.fn()
        const subscriptions = { created: handler }
        const subscriber = new StoreEventsSubscriber('subscriber-a', store, subscriptions)

        expect(subscriber.id).toBe('subscriber-a')
        expect(subscriber.subscriptions).toBe(subscriptions)
    })

    it('starts with no subscriptions when none are provided', () => {
        const subscriber = new StoreEventsSubscriber('subscriber-a', createStore('store-a'))

        expect(subscriber.subscriptions).toEqual({})
        expect(subscriber.hasSubscriptions(createStore('store-a'))).toBe(false)
    })

    it('returns and recognizes subscriptions only for its store', () => {
        const store = createStore('store-a')
        const otherStore = createStore('store-b')
        const handler = vi.fn()
        const subscriber = new StoreEventsSubscriber('subscriber-a', store, { created: handler })

        expect(subscriber.getSubscription('created', store)).toBe(handler)
        expect(subscriber.hasSubscription('created', store)).toBe(true)
        expect(subscriber.hasSubscriptions(store)).toBe(true)

        expect(subscriber.getSubscription('created', otherStore)).toBeUndefined()
        expect(subscriber.hasSubscription('created', otherStore)).toBe(false)
        expect(subscriber.hasSubscriptions(otherStore)).toBe(false)
    })

    it('returns undefined and false for events that are not subscribed', () => {
        const store = createStore('store-a')
        const subscriber = new StoreEventsSubscriber('subscriber-a', store, { created: vi.fn() })

        expect(subscriber.getSubscription('deleted', store)).toBeUndefined()
        expect(subscriber.hasSubscription('deleted', store)).toBe(false)
    })

    it('adds and replaces event handlers with subscribe', () => {
        const store = createStore('store-a')
        const firstHandler = vi.fn()
        const secondHandler = vi.fn()
        const subscriber = new StoreEventsSubscriber('subscriber-a', store)

        subscriber.subscribe('created', firstHandler)
        expect(subscriber.getSubscription('created', store)).toBe(firstHandler)

        subscriber.subscribe('created', secondHandler)
        expect(subscriber.getSubscription('created', store)).toBe(secondHandler)
        expect(subscriber.hasSubscriptions(store)).toBe(true)
    })

    it('removes an event handler with unsubscribe', () => {
        const store = createStore('store-a')
        const subscriber = new TestStoreEventsSubscriber('subscriber-a', store, { created: vi.fn() })

        subscriber.unsubscribeEvent('created')

        expect(subscriber.getSubscription('created', store)).toBeUndefined()
        expect(subscriber.hasSubscription('created', store)).toBe(false)
        expect(subscriber.hasSubscriptions(store)).toBe(false)
    })

    it('clears its identity and subscriptions', () => {
        const store = createStore('store-a')
        const subscriber = new StoreEventsSubscriber('subscriber-a', store, { created: vi.fn() })

        subscriber.clear()

        expect(subscriber.id).toBeUndefined()
        expect(subscriber.subscriptions).toEqual({})
        expect(subscriber.getSubscription('created', store)).toBeUndefined()
        expect(subscriber.hasSubscription('created', store)).toBe(false)
        expect(subscriber.hasSubscriptions(store)).toBe(false)
    })

    it('does not propagate errors for any event', () => {
        const subscriber = new StoreEventsSubscriber('subscriber-a', createStore('store-a'))

        expect(subscriber.shouldPropagateError('created')).toBe(false)
        expect(subscriber.shouldPropagateError('failed')).toBe(false)
    })
})
