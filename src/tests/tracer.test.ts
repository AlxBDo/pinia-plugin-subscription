import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTracerRegistry } from '../factories/trace-registry'

import type { TraceEvent } from '../types/trace'

function createCollector() {
    const events: TraceEvent[] = []
    return {
        events,
        filter: () => true,
        handler: (event: TraceEvent) => { events.push(event) }
    }
}

const registry = createTracerRegistry()
const { addListener, clearTraceListeners, hasTraceListeners } = registry
const createTracer = registry.tracerHandler.createTracer

describe('Tracer', () => {
    let consoleSpy: any

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        clearTraceListeners()
    })

    describe('Trace groups registry', () => {
        it('groups matching events by scope and flushes them when the group closes', () => {
            const registry = createTracerRegistry()
            const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => { })
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            registry.addListener([{ target: 'scope', value: 'cart' }])

            registry.tracerHandler.startGroup({ scope: 'cart' } as TraceEvent)
            registry.tracerHandler.createTracer('Store').debug('Mutation', 'store:mutation', { count: 1 }, 'cart')
            expect(groupSpy).not.toHaveBeenCalled()

            registry.tracerHandler.closeGroup({ scope: 'cart' } as TraceEvent)

            expect(groupSpy).toHaveBeenCalled()
            expect(logSpy).not.toHaveBeenCalled()
            groupSpy.mockRestore()
            logSpy.mockRestore()
        })

        it('uses the configured filter mode when selecting groups', () => {
            const registry = createTracerRegistry()
            const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => { })
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            registry.addListener([
                { target: 'scope', value: 'cart' },
                { target: 'namespace', value: 'store:mutation' },
            ], { filterMode: 'some' })

            registry.tracerHandler.startGroup({ scope: 'cart' } as TraceEvent)
            registry.tracerHandler.createTracer('Store').debug('Mutation', 'plugin:invoke', undefined, 'cart')
            registry.tracerHandler.closeGroup({ scope: 'cart' } as TraceEvent)

            expect(groupSpy).toHaveBeenCalled()
            expect(logSpy).not.toHaveBeenCalled()
            groupSpy.mockRestore()
            logSpy.mockRestore()
        })
    })

    afterEach(() => {
        consoleSpy.mockRestore()
    })

    describe('lazy payload', () => {
        it('does not resolve the payload when nobody listens', () => {
            const payload = vi.fn(() => ({ heavy: true }))
                ; (createTracer('Source')).debug('Mutation', 'store:mutation', payload)

            expect(payload).not.toHaveBeenCalled()
        })

        it('does not resolve the payload when every filter rejects the event', () => {
            const payload = vi.fn(() => ({ heavy: true }))
            addListener({ filter: () => false, handler: () => { } })

                ; (createTracer('Source')).debug('Mutation', 'store:mutation', payload)

            expect(payload).not.toHaveBeenCalled()
        })

        it('resolves the payload once a listener matches', () => {
            const payload = vi.fn(() => ({ heavy: true }))
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('Source')).debug('Mutation', 'store:mutation', payload)

            expect(payload).toHaveBeenCalledTimes(1)
            expect(collector.events[0]!.payload).toEqual({ heavy: true })
        })

        it('accepts a plain object payload', () => {
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('Source')).debug('Mutation', 'store:mutation', { direct: 1 })

            expect(collector.events[0]!.payload).toEqual({ direct: 1 })
        })

        it('never lets a throwing payload factory break the caller', () => {
            const collector = createCollector()
            addListener(collector)

            expect(() => (createTracer('Source')).debug('Mutation', 'ns', () => { throw new Error('boom') })).not.toThrow()
            expect(collector.events[0]!.payload).toHaveProperty('__tracePayloadError')
        })
    })

    describe('event shape', () => {
        it('exposes namespace, source, scope and timestamp', () => {
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('PluginSubscription')).debug('Subscription:delivery', 'subscription:delivery', undefined, 'cart')

            expect(collector.events[0]!).toMatchObject({
                level: 'debug',
                label: 'Subscription:delivery',
                namespace: 'subscription:delivery',
                scope: 'cart',
                source: 'PluginSubscription'
            })
            expect(typeof collector.events[0]!.timestamp).toBe('number')
        })

        it('falls back to the tracer scope when none is given', () => {
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('Store', { scope: 'user' })).debug('Mutation', 'ns')

            expect(collector.events[0]!.scope).toBe('user')
        })

        it('lets an explicit scope override the tracer scope', () => {
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('Store', { scope: 'user' })).debug('Mutation', 'ns', undefined, 'cart')

            expect(collector.events[0]!.scope).toBe('cart')
        })
    })

    describe('filtering', () => {
        it('delivers only events matching the filter', () => {
            const collector = createCollector()
            addListener({
                filter: (event) => event.namespace.startsWith('store:'),
                handler: collector.handler
            })

            const tracer = createTracer('Source')
            tracer.debug('Mutation', 'store:mutation')
            tracer.debug('Invoke', 'plugin:invoke')

            expect(collector.events.map(e => e.namespace)).toEqual(['store:mutation'])
        })

        it('supports filtering by scope, enabling per-instance tracing', () => {
            const collector = createCollector()
            addListener({ filter: (event) => event.scope === 'cart', handler: collector.handler })

            const tracer = createTracer('Source')
            tracer.debug('Mutation', 'ns', undefined, 'cart')
            tracer.debug('Mutation', 'ns', undefined, 'user')

            expect(collector.events).toHaveLength(1)
            expect(collector.events[0]!.scope).toBe('cart')
        })

        it('treats a throwing filter as non matching', () => {
            const collector = createCollector()
            addListener({ filter: () => { throw new Error('bad filter') }, handler: collector.handler })

            expect(() => (createTracer('Source')).debug('Mutation', 'ns')).not.toThrow()
            expect(collector.events).toHaveLength(0)
        })
    })

    describe('listener registry', () => {
        it('reports whether listeners are registered', () => {
            expect(hasTraceListeners()).toBe(false)
            addListener({ filter: () => true, handler: () => { } })
            expect(hasTraceListeners()).toBe(true)
        })

        it('isolates listeners between registries', () => {
            const firstRegistry = createTracerRegistry()
            const secondRegistry = createTracerRegistry()
            const first = createCollector()
            const second = createCollector()
            firstRegistry.addListener(first)

            firstRegistry.tracerHandler.createTracer('Source').debug('Mutation', 'ns')
            secondRegistry.tracerHandler.createTracer('Source').debug('Mutation', 'ns')

            expect(first.events).toHaveLength(1)
            expect(second.events).toHaveLength(0)
            expect(secondRegistry.hasTraceListeners()).toBe(false)
        })

        it('stops delivering to an existing tracer once listeners are cleared', () => {
            const collector = createCollector()
            const tracer = createTracer('Source')
            addListener(collector)

            tracer.debug('Mutation', 'ns')
            clearTraceListeners()
            tracer.debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(1)
            expect(hasTraceListeners()).toBe(false)
        })

        it('delivers to listeners registered after a tracer was created', () => {
            const collector = createCollector()
            const tracer = createTracer('Source')
            clearTraceListeners()
            addListener(collector)

            tracer.debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(1)
        })

        it('does not mutate the listener definition it is given', () => {
            const definition = { filter: [{ target: 'scope' as const, value: 'cart' }] }
            const collector = createCollector()

            addListener({ ...definition, handler: collector.handler })
            addListener(definition)

            expect(Array.isArray(definition.filter)).toBe(true)
        })

        it('keeps the custom handler of a listener defined with filter criteria', () => {
            const collector = createCollector()
            addListener({ filter: [{ target: 'scope', value: 'cart' }], handler: collector.handler })

            createTracer('Source', { scope: 'cart' }).debug('Mutation', 'ns')
            createTracer('Source', { scope: 'other' }).debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(1)
        })

        it('removes a listener through the returned remover', () => {
            const collector = createCollector()
            const remove = addListener(collector)

            remove()
                ; (createTracer('Source')).debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(0)
        })

        it('delivers to every registered listener', () => {
            const first = createCollector()
            const second = createCollector()
            addListener(first)
            addListener(second)

                ; (createTracer('Source')).debug('Mutation', 'ns')

            expect(first.events).toHaveLength(1)
            expect(second.events).toHaveLength(1)
        })

        it('isolates a throwing listener from the traced code and other listeners', () => {
            const collector = createCollector()
            addListener({ filter: () => true, handler: () => { throw new Error('listener down') } })
            addListener(collector)

            expect(() => (createTracer('Source')).debug('Mutation', 'ns')).not.toThrow()
            expect(collector.events).toHaveLength(1)
        })
    })

    describe('production guard', () => {
        afterEach(() => vi.unstubAllEnvs())

        it('ignores listeners in production by default', () => {
            vi.stubEnv('NODE_ENV', 'production')
            const prodRegistry = createTracerRegistry()
            const collector = createCollector()

            const remove = prodRegistry.addListener(collector)
            prodRegistry.tracerHandler.createTracer('Source').debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(0)
            expect(prodRegistry.hasTraceListeners()).toBe(false)
            expect(() => remove()).not.toThrow()
        })

        it('still reports errors with console.error in production', () => {
            vi.stubEnv('NODE_ENV', 'production')
            const prodRegistry = createTracerRegistry()
            prodRegistry.addListener(createCollector())

            prodRegistry.tracerHandler.createTracer('Source').error('Failed', 'ns', new Error('boom'))

            expect(consoleSpy).toHaveBeenCalledWith('Unhandled error trace event:', expect.any(Error))
        })

        it('can be explicitly enabled in production', () => {
            vi.stubEnv('NODE_ENV', 'production')
            const prodRegistry = createTracerRegistry({ enabled: true })
            const collector = createCollector()
            prodRegistry.addListener(collector)

            prodRegistry.tracerHandler.createTracer('Source').debug('Mutation', 'ns')

            expect(collector.events).toHaveLength(1)
        })

        it('can be explicitly disabled outside production', () => {
            const disabledRegistry = createTracerRegistry({ enabled: false })

            disabledRegistry.addListener(createCollector())

            expect(disabledRegistry.hasTraceListeners()).toBe(false)
        })

        it('is enabled outside production', () => {
            vi.stubEnv('NODE_ENV', 'development')
            const devRegistry = createTracerRegistry()

            devRegistry.addListener(createCollector())

            expect(devRegistry.hasTraceListeners()).toBe(true)
        })
    })

    describe('error propagation', () => {
        it('delivers error events to listeners too', () => {
            const collector = createCollector()
            addListener(collector)

                ; (createTracer('Source')).error('Failure', 'ns', new Error('boom'))

            expect(collector.events[0]!.level).toBe('error')
            expect(collector.events[0]!.error).toBeInstanceOf(Error)
        })

        it('log error when no listener is registered', () => {
            const failure = new Error('boom')
            createTracer('Source').error('Failure', 'ns', failure)
            expect(console.error).toHaveBeenCalled()
        })

        it('log error when registered listeners reject the event', () => {
            const failure = new Error('boom')
            addListener({
                filter: event => event.level === 'debug',
                handler: () => { }
            })
            createTracer('Source').error('Failure', 'ns', failure)

            expect(console.error).toHaveBeenCalled()
        })

        it('does not rethrow when at least one listener matches', () => {
            const failure = new Error('boom')
            addListener({ filter: () => true, handler: () => { } })

            expect(() => (createTracer('Source')).error('Failure', 'ns', failure)).not.toThrow()
        })

        it('isolates a throwing error listener', () => {
            const failure = new Error('boom')
            addListener({ filter: () => true, handler: () => { throw new Error('listener down') } })

            expect(() => (createTracer('Source')).error('Failure', 'ns', failure)).not.toThrow()
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
