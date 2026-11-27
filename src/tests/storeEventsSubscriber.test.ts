import { describe, expect, it, vi } from 'vitest'
import EventSubscription from '../events/events-subscription'
import StoreEvent from '../events/store-event'
import { createEventsRegistry } from '../factories/events-registry'

describe('EventsSubscriber', () => {
    it('receives matching events from subscriptions provided at construction', () => {
        const registry = createEventsRegistry()
        const handler = vi.fn()
        const subscriber = registry.createSubscriber('subscriber-a', [
            new EventSubscription('created', handler, { scope: 'store-a', instanceId: 'instance-a' })
        ])
        const event = new StoreEvent('created', { scope: 'store-a', instanceId: 'instance-a' })

        registry.emitter.emit(new StoreEvent('other', { scope: 'store-a', instanceId: 'instance-a' }))
        registry.emitter.emit(new StoreEvent('created', { scope: 'store-b', instanceId: 'instance-a' }))
        registry.emitter.emit(new StoreEvent('created', { scope: 'store-a', instanceId: 'instance-b' }))
        registry.emitter.emit(event)

        expect(handler).toHaveBeenCalledOnce()
        expect(handler).toHaveBeenCalledWith(event)
        subscriber.unsubscribe()
    })

    it('keeps multiple subscriptions for the same event', () => {
        const registry = createEventsRegistry()
        const subscriber = registry.createSubscriber('subscriber-a')
        const first = vi.fn()
        const second = vi.fn()
        const event = new StoreEvent('created')
        subscriber.addSubscription('created', first)
        subscriber.addSubscription('created', second)

        registry.emitter.emit(event)

        expect(first).toHaveBeenCalledWith(event)
        expect(second).toHaveBeenCalledWith(event)
        subscriber.unsubscribe()
    })

    it('clears subscriptions and stops receiving events after unsubscribe', () => {
        const registry = createEventsRegistry()
        const subscriber = registry.createSubscriber('subscriber-a')
        const handler = vi.fn()
        subscriber.addSubscription('created', handler)
        subscriber.clear()
        registry.emitter.emit(new StoreEvent('created'))
        expect(handler).not.toHaveBeenCalled()

        subscriber.addSubscription('created', handler)
        registry.emitter.emit(new StoreEvent('created'))
        expect(handler).toHaveBeenCalledOnce()
        subscriber.unsubscribe()
        registry.emitter.emit(new StoreEvent('created'))
        expect(handler).toHaveBeenCalledOnce()
    })
})
