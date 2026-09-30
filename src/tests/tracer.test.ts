import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTracerRegistry } from '../factories/trace-registry'

import type { TraceEvent } from '../types/trace'

function createCollector() {
    const events: TraceEvent[] = []
    return { events, handler: (event: TraceEvent) => { events.push(event) } }
}

const { addTraceListener, clearTraceListeners, createTracer, hasTraceListeners } = createTracerRegistry()

describe('Tracer', () => {
    let consoleSpy: any

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        clearTraceListeners()
    })

    afterEach(() => {
        consoleSpy.mockRestore()
    })

    describe('lazy payload', () => {
        it('does not resolve the payload when nobody listens', () => {
            const payload = vi.fn(() => ({ heavy: true }))
                ; (createTracer('Source')).debug('store:mutation', payload)

            expect(payload).not.toHaveBeenCalled()
        })

        it('does not resolve the payload when every filter rejects the event', () => {
            const payload = vi.fn(() => ({ heavy: true }))
            addTraceListener({ filter: () => false, handler: () => { } })

                ; (createTracer('Source')).debug('store:mutation', payload)

            expect(payload).not.toHaveBeenCalled()
        })

        it('resolves the payload once a listener matches', () => {
            const payload = vi.fn(() => ({ heavy: true }))
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('Source')).debug('store:mutation', payload)

            expect(payload).toHaveBeenCalledTimes(1)
            expect(collector.events[0].payload).toEqual({ heavy: true })
        })

        it('accepts a plain object payload', () => {
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('Source')).debug('store:mutation', { direct: 1 })

            expect(collector.events[0].payload).toEqual({ direct: 1 })
        })

        it('never lets a throwing payload factory break the caller', () => {
            const collector = createCollector()
            addTraceListener(collector)

            expect(() => (createTracer('Source')).debug('ns', () => { throw new Error('boom') })).not.toThrow()
            expect(collector.events[0].payload).toHaveProperty('__tracePayloadError')
        })
    })

    describe('event shape', () => {
        it('exposes namespace, source, scope and timestamp', () => {
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('PluginSubscription')).debug('subscription:delivery', undefined, 'cart')

            expect(collector.events[0]).toMatchObject({
                level: 'debug',
                namespace: 'subscription:delivery',
                scope: 'cart',
                source: 'PluginSubscription'
            })
            expect(typeof collector.events[0].timestamp).toBe('number')
        })

        it('falls back to the tracer scope when none is given', () => {
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('Store', { scope: 'user' })).debug('ns')

            expect(collector.events[0].scope).toBe('user')
        })

        it('lets an explicit scope override the tracer scope', () => {
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('Store', { scope: 'user' })).debug('ns', undefined, 'cart')

            expect(collector.events[0].scope).toBe('cart')
        })
    })

    describe('filtering', () => {
        it('delivers only events matching the filter', () => {
            const collector = createCollector()
            addTraceListener({
                filter: (event) => event.namespace.startsWith('store:'),
                handler: collector.handler
            })

            const tracer = createTracer('Source')
            tracer.debug('store:mutation')
            tracer.debug('plugin:invoke')

            expect(collector.events.map(e => e.namespace)).toEqual(['store:mutation'])
        })

        it('supports filtering by scope, enabling per-instance tracing', () => {
            const collector = createCollector()
            addTraceListener({ filter: (event) => event.scope === 'cart', handler: collector.handler })

            const tracer = createTracer('Source')
            tracer.debug('ns', undefined, 'cart')
            tracer.debug('ns', undefined, 'user')

            expect(collector.events).toHaveLength(1)
            expect(collector.events[0].scope).toBe('cart')
        })

        it('treats a throwing filter as non matching', () => {
            const collector = createCollector()
            addTraceListener({ filter: () => { throw new Error('bad filter') }, handler: collector.handler })

            expect(() => (createTracer('Source')).debug('ns')).not.toThrow()
            expect(collector.events).toHaveLength(0)
        })
    })

    describe('listener registry', () => {
        it('reports whether listeners are registered', () => {
            expect(hasTraceListeners()).toBe(false)
            addTraceListener({ handler: () => { } })
            expect(hasTraceListeners()).toBe(true)
        })

        it('removes a listener through the returned remover', () => {
            const collector = createCollector()
            const remove = addTraceListener(collector)

            remove()
                ; (createTracer('Source')).debug('ns')

            expect(collector.events).toHaveLength(0)
        })

        it('delivers to every registered listener', () => {
            const first = createCollector()
            const second = createCollector()
            addTraceListener(first)
            addTraceListener(second)

                ; (createTracer('Source')).debug('ns')

            expect(first.events).toHaveLength(1)
            expect(second.events).toHaveLength(1)
        })

        it('isolates a throwing listener from the traced code and other listeners', () => {
            const collector = createCollector()
            addTraceListener({ handler: () => { throw new Error('listener down') } })
            addTraceListener(collector)

            expect(() => (createTracer('Source')).debug('ns')).not.toThrow()
            expect(collector.events).toHaveLength(1)
        })
    })

    describe('error propagation', () => {
        it('delivers error events to listeners too', () => {
            const collector = createCollector()
            addTraceListener(collector)

                ; (createTracer('Source')).error('ns', new Error('boom'))

            expect(collector.events[0].level).toBe('error')
            expect(collector.events[0].error).toBeInstanceOf(Error)
        })

        it('log error when no listener is registered', () => {
            const failure = new Error('boom')
            createTracer('Source').error('ns', failure)
            expect(console.error).toHaveBeenCalled()
        })

        it('log error when registered listeners reject the event', () => {
            const failure = new Error('boom')
            addTraceListener({
                filter: event => event.level === 'debug',
                handler: () => { }
            })
            createTracer('Source').error('ns', failure)

            expect(console.error).toHaveBeenCalled()
        })

        it('does not rethrow when at least one listener matches', () => {
            const failure = new Error('boom')
            addTraceListener({ handler: () => { } })

            expect(() => (createTracer('Source')).error('ns', failure)).not.toThrow()
        })

        it('isolates a throwing error listener', () => {
            const failure = new Error('boom')
            addTraceListener({ handler: () => { throw new Error('listener down') } })

            expect(() => (createTracer('Source')).error('ns', failure)).not.toThrow()
        })
    })

    describe('accessors', () => {
        it('exposes its source', () => {
            expect(createTracer('PluginSubscription').source).toBe('PluginSubscription')
        })

        it('exposes and updates its scope', () => {
            const tracer = createTracer('Source', { scope: 'user' })
            expect(tracer.scope).toBe('user')

            tracer.scope = 'cart'
            expect(tracer.scope).toBe('cart')
        })

    })
})
