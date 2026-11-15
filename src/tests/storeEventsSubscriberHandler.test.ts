import { createPinia, defineStore } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StoreEventsSubscriber from '../events/store-events-subscriber'
import StoreEventsSubscriberHandler from '../events/store-events-subscriber-handler'

describe('StoreEventsSubscriberHandler', () => {
    afterEach(() => vi.restoreAllMocks())

    it('reports each synchronous failure and continues delivery without interrupting the emitter', () => {
        const store = defineStore('events', {})(createPinia())
        const handler = new StoreEventsSubscriberHandler()
        const firstError = new Error('first')
        const secondError = new Error('second')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const last = vi.fn()
        class FormerCriticalSubscriber extends StoreEventsSubscriber {
            shouldPropagateError() { return true }
        }
        handler.subscribe(store.$id, new FormerCriticalSubscriber('first', store, {
            changed: () => { throw firstError }
        }))
        handler.subscribe(store.$id, new StoreEventsSubscriber('second', store, {
            changed: () => { throw secondError }
        }))
        handler.subscribe(store.$id, new StoreEventsSubscriber('last', store, { changed: last }))

        const emitAndContinue = () => {
            handler.emit(store, 'changed', () => [42])
            return 'continued'
        }

        expect(emitAndContinue()).toBe('continued')
        expect(last).toHaveBeenCalledWith(42)
        expect(log).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenNthCalledWith(1, "Error emitting event 'changed' for store 'events':", firstError)
        expect(log).toHaveBeenNthCalledWith(2, "Error emitting event 'changed' for store 'events':", secondError)
    })

    it('reports payload factory failures and continues to the next subscriber', () => {
        const store = defineStore('events', {})(createPinia())
        const handler = new StoreEventsSubscriberHandler()
        const failure = new Error('payload failed')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const first = vi.fn()
        const second = vi.fn()
        const payload = vi.fn().mockImplementationOnce(() => { throw failure }).mockReturnValue([42])
        handler.subscribe(store.$id, new StoreEventsSubscriber('first', store, { changed: first }))
        handler.subscribe(store.$id, new StoreEventsSubscriber('second', store, { changed: second }))

        expect(() => handler.emit(store, 'changed', payload)).not.toThrow()
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledWith(42)
        expect(log).toHaveBeenCalledWith("Error emitting event 'changed' for store 'events':", failure)
    })

    it('reports async rejections without waiting for or interrupting other subscribers', async () => {
        const store = defineStore('events', {})(createPinia())
        const handler = new StoreEventsSubscriberHandler()
        const failure = new Error('async failure')
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const next = vi.fn()
        handler.subscribe(store.$id, new StoreEventsSubscriber('async', store, {
            changed: async () => { throw failure }
        }))
        handler.subscribe(store.$id, new StoreEventsSubscriber('next', store, { changed: next }))

        expect(() => handler.emit(store, 'changed')).not.toThrow()
        expect(next).toHaveBeenCalledOnce()
        await vi.waitFor(() => {
            expect(log).toHaveBeenCalledWith("Error emitting event 'changed' for store 'events':", failure)
        })
    })
})
