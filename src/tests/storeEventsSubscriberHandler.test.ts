import { afterEach, describe, expect, it, vi } from 'vitest'
import StoreEvent from '../events/store-event'
import { createEventsRegistry } from '../factories/events-registry'

describe('event delivery', () => {
    afterEach(() => vi.restoreAllMocks())

    it('reports synchronous failures and continues delivery without interrupting the emitter', () => {
        const registry = createEventsRegistry()
        const firstError = new Error('first')
        const secondError = new Error('second')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const last = vi.fn()
        registry.createSubscriber('first').addSubscription('changed', () => { throw firstError })
        registry.createSubscriber('second').addSubscription('changed', () => { throw secondError })
        registry.createSubscriber('last').addSubscription('changed', last)
        const event = new StoreEvent('changed', { payload: () => ({ value: 42 }) })

        expect(() => registry.emitter.emit(event)).not.toThrow()
        expect(last).toHaveBeenCalledWith(event)
        expect(log).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenNthCalledWith(1, '[EventSubscription] Error consuming event:', firstError)
        expect(log).toHaveBeenNthCalledWith(2, '[EventSubscription] Error consuming event:', secondError)
    })

    it('resolves payloads lazily and reports failures without interrupting other consumers', () => {
        const registry = createEventsRegistry()
        const failure = new Error('payload failed')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const second = vi.fn()
        const payload = vi.fn().mockImplementationOnce(() => { throw failure }).mockReturnValue({ value: 42 })
        registry.createSubscriber('first').addSubscription('changed', event => event.payload?.())
        registry.createSubscriber('second').addSubscription('changed', event => second(event.payload?.()))
        const event = new StoreEvent('changed', { payload })

        expect(payload).not.toHaveBeenCalled()
        expect(() => registry.emitter.emit(event)).not.toThrow()
        expect(second).toHaveBeenCalledWith({ value: 42 })
        expect(log).toHaveBeenCalledWith('[EventSubscription] Error consuming event:', failure)
    })

    it('reports async rejections without waiting for or interrupting other subscribers', async () => {
        const registry = createEventsRegistry()
        const failure = new Error('async failure')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const next = vi.fn()
        registry.createSubscriber('async').addSubscription('changed', async () => { throw failure })
        registry.createSubscriber('next').addSubscription('changed', next)

        expect(() => registry.emitter.emit(new StoreEvent('changed'))).not.toThrow()
        expect(next).toHaveBeenCalledOnce()
        await vi.waitFor(() => {
            expect(log).toHaveBeenCalledWith('[EventSubscription] Error consuming event:', failure)
        })
    })
})
