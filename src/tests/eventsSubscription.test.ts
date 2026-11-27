import { describe, expect, it, vi } from 'vitest'
import Event from '../events/event'
import EventSubscription from '../events/events-subscription'
import { createEventsRegistry } from '../factories/events-registry'
import { registerInstance } from '../utils/id'

describe('EventSubscription', () => {
    it('matches only events with the subscribed name and scope', () => {
        const consumer = vi.fn()
        const subscription = new EventSubscription('store:action:before', consumer, { scope: 'store-a' })

        expect(subscription.subscribed(new Event('store:action:after', { scope: 'store-a' }))).toBe(false)
        expect(subscription.subscribed(new Event('store:action:before', { scope: 'store-b' }))).toBe(false)
        expect(subscription.subscribed(new Event('store:action:before', { scope: 'store-a' }))).toBe(true)
    })

    it('assigns distinct instance and subscriber IDs for prototype property names', () => {
        const first = {}
        const second = {}
        const firstId = registerInstance('__proto__', first)
        const secondId = registerInstance('__proto__', second)
        expect(firstId).not.toBe(secondId)
        expect(registerInstance('__proto__', first)).toBe(firstId)

        const registry = createEventsRegistry()
        const firstSubscriber = registry.createSubscriber('__proto__')
        const secondSubscriber = registry.createSubscriber('__proto__')
        const listener = vi.fn()
        secondSubscriber.addSubscription('test', listener)
        firstSubscriber.unsubscribe()
        registry.emitter.emit(new Event('test'))
        expect(listener).toHaveBeenCalledOnce()
        secondSubscriber.unsubscribe()
    })
})
