import { describe, expect, it } from 'vitest'
import { createTracerRegistry } from '../factories/trace-registry'
import { stringifyForHtml, toSerializable } from '../utils/toSerializable'

describe('toSerializable', () => {
    it('handles circular references, internals, functions and special objects', () => {
        const value: any = { _private: 1, fn: function named() { }, date: new Date(0), map: new Map([['a', 1]]), set: new Set([1]) }
        value.self = value

        expect(toSerializable(value)).toEqual({
            date: '1970-01-01T00:00:00.000Z',
            fn: '[Function named]',
            map: { __type: 'Map', entries: [['a', 1]] },
            self: '[Circular]',
            set: { __type: 'Set', values: [1] }
        })
    })

    it('bounds depth, entries and nodes, and survives throwing getters', () => {
        expect(toSerializable({ a: { b: { c: 1 } } }, { maxDepth: 2 })).toEqual({ a: { b: '[Object]' } })
        expect(toSerializable([1, 2, 3], { maxEntries: 2 })).toEqual([1, 2, '… 1 more'])
        expect(toSerializable([{}, {}, {}], { maxNodes: 2 })).toEqual([{}, '[Truncated]', '[Truncated]'])
        expect(toSerializable({ get bad() { throw new Error('x') } })).toEqual({ bad: '[Unreadable]' })
    })

    it('drops error stacks', () => {
        expect(toSerializable(new Error('boom'))).toEqual({ message: 'boom', name: 'Error' })
    })

    it('escapes HTML-significant characters', () => {
        expect(stringifyForHtml({ a: '</script>\u2028' })).not.toMatch(/<|\u2028/)
    })
})

describe('journal serialize / import', () => {
    function serverSnapshot() {
        const server = createTracerRegistry({ journal: true, side: 'server' })
        const tracer = server.tracerHandler.createTracer('Store')
        tracer.debug('Context', 'pluginsubscription:context', { store: { $id: 'cart', _p: 'hidden' } }, 'cart')
        tracer.debug('Hydrate', 'ns', { actionId: 'cart#1', value: 1 }, 'cart')
        return JSON.parse(stringifyForHtml(server.journal!.serialize()))
    }

    it('carries server events to the client, before local events', () => {
        const client = createTracerRegistry({ journal: true, side: 'client' })
        client.tracerHandler.createTracer('Store').debug('Local', 'ns', undefined, 'cart')

        expect(client.journal!.import(serverSnapshot())).toBe(2)

        const events = client.journal!.getEvents('cart')
        expect(events.map(event => [event.side, event.label])).toEqual([
            ['server', 'Context'], ['server', 'Hydrate'], ['client', 'Local']
        ])
        expect(events[0]!.payload).toEqual({ store: { $id: 'cart' } })
        expect(events[1]).toMatchObject({ actionId: 'cart#1', payload: { value: 1 } })
    })

    it('replaces previously imported events and notifies subscribers', () => {
        const client = createTracerRegistry({ journal: true })
        const received: string[] = []
        client.journal!.subscribe(event => received.push(event.label))

        client.journal!.import(serverSnapshot())
        client.journal!.import(serverSnapshot())

        expect(client.journal!.getEvents('cart')).toHaveLength(2)
        expect(received).toHaveLength(4)
    })

    it('ignores malformed input', () => {
        const journal = createTracerRegistry({ journal: true }).journal!

        expect(journal.import(null)).toBe(0)
        expect(journal.import({ events: 'x' })).toBe(0)
        expect(journal.import({ events: [null, 1, { label: 'x' }, { label: 'x', level: 'warn' }] })).toBe(0)
        expect(journal.getScopes()).toEqual([])
    })

    it('never copies unknown fields from imported events', () => {
        const journal = createTracerRegistry({ journal: true }).journal!

        journal.import({ events: [{ evil: true, label: 'l', level: 'debug', namespace: 'n', scope: 's', seq: 1, source: 'x', timestamp: 1 }] })

        expect(journal.getEvents('s')[0]).not.toHaveProperty('evil')
    })
})
