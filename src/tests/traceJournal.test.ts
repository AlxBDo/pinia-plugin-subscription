import { describe, expect, it, vi } from 'vitest'
import { createTracerRegistry } from '../factories/trace-registry'
import { createTraceJournal } from '../system/TraceJournal'
import PluginSubscription from '../core/PluginSubscription'

import type { TraceEvent } from '../types/trace'

function event(partial: Partial<TraceEvent>): TraceEvent {
    return { label: 'L', level: 'debug', namespace: 'ns', source: 'S', timestamp: 0, ...partial }
}

describe('TraceJournal', () => {
    it('orders events of a store by seq', () => {
        const journal = createTraceJournal()
        journal.append(event({ scope: 'a', seq: 2, side: 'server' }))
        journal.append(event({ scope: 'a', seq: 1 }))
        journal.append(event({ scope: 'b', seq: 3 }))

        expect(journal.getEvents('a').map(e => e.seq)).toEqual([1, 2])
        expect(journal.getScopes()).toEqual(['a', 'b'])
    })

    it('evicts the oldest events beyond the cap and counts them', () => {
        const journal = createTraceJournal({ maxEventsPerStore: 2 })
        for (let seq = 1; seq <= 4; seq++) { journal.append(event({ scope: 'a', seq })) }

        expect(journal.getEvents('a').map(e => e.seq)).toEqual([3, 4])
        expect(journal.getDropped('a')).toBe(2)
    })

    it('keeps context and error events when regular events are evicted', () => {
        const journal = createTraceJournal({ maxEventsPerStore: 1 })
        journal.append(event({ scope: 'a', seq: 1, namespace: 'pluginsubscription:context' }))
        journal.append(event({ scope: 'a', seq: 2, level: 'error' }))
        journal.append(event({ scope: 'a', seq: 3 }))
        journal.append(event({ scope: 'a', seq: 4 }))

        expect(journal.getEvents('a').map(e => e.seq)).toEqual([2, 4])
    })

    it('does not let client events evict server events', () => {
        const journal = createTraceJournal({ maxEventsPerStore: 1 })
        journal.append(event({ scope: 'a', seq: 1, side: 'server' }))
        journal.append(event({ scope: 'a', seq: 2 }))
        journal.append(event({ scope: 'a', seq: 3 }))

        expect(journal.getEvents('a').map(e => e.seq)).toEqual([1, 3])
    })

    it('notifies subscribers, isolates their failures and supports removal', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const journal = createTraceJournal()
        const listener = vi.fn()
        journal.subscribe(() => { throw new Error('boom') })
        const remove = journal.subscribe(listener)

        journal.append(event({ scope: 'a' }))
        remove()
        journal.append(event({ scope: 'a' }))

        expect(listener).toHaveBeenCalledTimes(1)
        expect(errorSpy).toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it('clears one store or all stores', () => {
        const journal = createTraceJournal()
        journal.append(event({ scope: 'a' }))
        journal.append(event({ scope: 'b' }))

        journal.clear('a')
        expect(journal.getScopes()).toEqual(['b'])
        journal.clear()
        expect(journal.getScopes()).toEqual([])
    })
})

describe('registry journal', () => {
    it('is undefined unless enabled, and when the registry is disabled', () => {
        expect(createTracerRegistry().journal).toBeUndefined()
        expect(createTracerRegistry({ enabled: false, journal: true }).journal).toBeUndefined()
    })

    it('records events without any listener, with seq, side and lifted actionId', () => {
        const registry = createTracerRegistry({ journal: true, side: 'server', redact: true })
        const tracer = registry.tracerHandler.createTracer('Store')

        tracer.debug('Label', 'ns', { actionId: 'cart#1', password: 'x', value: 1 }, 'cart')
        tracer.debug('Second', 'ns', undefined, 'cart')

        const [first, second] = registry.journal!.getEvents('cart')
        expect(first).toMatchObject({ actionId: 'cart#1', seq: 1, side: 'server', payload: { password: '[REDACTED]', value: 1 } })
        expect(first!.payload).not.toHaveProperty('actionId')
        expect(second!.seq).toBe(2)
        expect(registry.tracerHandler.hasTraceListeners?.()).toBe(true)
    })

    it('still reports unhandled errors on the console while recording them', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const registry = createTracerRegistry({ journal: true })

        registry.tracerHandler.createTracer('Store').error('Failed', 'ns', new Error('x'), undefined, 'cart')

        expect(registry.journal!.getEvents('cart')).toHaveLength(1)
        expect(errorSpy).toHaveBeenCalledWith('Unhandled error trace event:', expect.any(Error))
        errorSpy.mockRestore()
    })

    it('correlates the events of one action and keeps the store context', () => {
        const registry = createTracerRegistry({ journal: true })
        const plugin = new PluginSubscription(
            [{ name: 'sub', subscriptions: { $onAction: [() => { }] } } as any],
            { tracerHandler: registry.tracerHandler } as any
        )
        let onActionCb: any
        const store: any = {
            $id: 'cart',
            $state: {},
            $onAction: (cb: any) => { onActionCb = cb },
            $subscribe: () => () => { },
            $reset: () => { },
            $dispose: () => { }
        }
        plugin.plugin({ store, options: {} } as any)
        expect(registry.journal!.getEvents('cart').some(e => e.namespace.endsWith(':context'))).toBe(true)
        if (!onActionCb) { return }

        onActionCb({ after: () => { }, args: [], name: 'add', onError: () => { } })
        const actionEvents = registry.journal!.getEvents('cart').filter(e => e.actionId)
        expect(actionEvents.length).toBeGreaterThan(0)
        expect(new Set(actionEvents.map(e => e.actionId)).size).toBe(1)
    })
})
