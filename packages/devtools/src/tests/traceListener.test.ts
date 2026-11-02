import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTraceListener } from '../factories/trace-listener'
import { pluginName, pluginSubscriptionNamespace } from '../utils/constants'

import type { TraceEvent } from '../types/trace'

function createEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
    return {
        level: 'debug',
        label: 'Store:mutation',
        namespace: 'store:mutation',
        source: 'PluginSubscription',
        timestamp: 1,
        ...overrides
    }
}

describe('createTraceListener', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it.each([
        ['equals', 'store:mutation', true],
        ['equals', 'store:action', false],
        ['contains', 'mutation', true],
        ['startsWith', 'store:', true],
        ['endsWith', ':mutation', true],
        ['unknown', 'store:mutation', false]
    ] as const)('filters namespace with the %s comparator', (comparator, value, expected) => {
        const listener = createTraceListener([{
            target: 'namespace',
            comparator,
            value
        }])

        expect(listener.filter(createEvent())).toBe(expected)
    })

    it('rejects a criterion when its event value is not a string', () => {
        const listener = createTraceListener([{
            target: 'scope',
            value: 'cart'
        }], false)

        expect(listener.filter(createEvent())).toBe(false)
    })

    it('matches any filter criterion when the some mode is selected', () => {
        const listener = createTraceListener([
            { target: 'scope', value: 'cart' },
            { target: 'namespace', value: 'store:mutation' }
        ], false, 'some')

        expect(listener.filter(createEvent())).toBe(true)
    })

    it('includes plugin subscription namespace events when context is enabled', () => {
        const listener = createTraceListener([{
            target: 'namespace',
            value: 'unmatched'
        }])

        expect(listener.filter(createEvent({
            source: pluginName,
            namespace: `${pluginSubscriptionNamespace}:invoke`
        }))).toBe(true)
        expect(listener.filter(createEvent({
            source: pluginName,
            namespace: undefined
        }))).toBe(true)
        expect(listener.filter(createEvent({
            source: pluginName,
            namespace: 'plugin:invoke'
        }))).toBe(false)
        expect(listener.filter(createEvent({
            source: 'Other'
        }))).toBe(false)
    })

    it('does not include plugin subscription namespace events when context is disabled', () => {
        const listener = createTraceListener([{
            target: 'namespace',
            value: 'unmatched'
        }], false)

        expect(listener.filter(createEvent())).toBe(false)
    })

    it('wraps array filters from listener definitions without mutating them', () => {
        const handler = vi.fn()
        const criteria = [{ target: 'namespace', value: 'store:mutation' }] as const
        const listenerDefinition = { handler, filter: criteria }
        const listener = createTraceListener(listenerDefinition)

        expect(listener.filter).toBeTypeOf('function')
        expect(listener.filter(createEvent())).toBe(true)
        expect(listenerDefinition.filter).toBe(criteria)
        expect(listener.handler).toBe(handler)
    })

    it('uses a no-op handler and never prints to the console when none is supplied', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createTraceListener([{ target: 'namespace', value: 'store:mutation' }])

        expect(() => listener.handler(createEvent())).not.toThrow()
        expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('preserves a custom filter from a listener definition', () => {
        const filter = vi.fn(() => true)
        const listener = createTraceListener({ handler: vi.fn(), filter })

        expect(listener.filter).toBe(filter)
    })
})
