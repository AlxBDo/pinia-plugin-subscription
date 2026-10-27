import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsoleGroupTraceListener } from '../factories/console-trace-listener'
import { createTraceGroupListener } from '../factories/trace-listener'
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

describe('createConsoleGroupTraceListener', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('uses the styled plugin console when no target is supplied', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createTraceGroupListener([{
            target: 'namespace', value: 'store:mutation',
        }], false)

        listener.handler(createEvent())

        expect(consoleSpy).toHaveBeenCalled()
    })

    it('writes debug events to log', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => { })
        const listener = createTraceGroupListener([{
            target: 'scope', value: 'cart',
        }], false)

        listener.handler(createEvent({
            payload: { mutation: 'direct' },
            scope: 'cart'
        }))

        expect(groupSpy).toHaveBeenCalledWith(
            '%c%s',
            expect.stringContaining('background-color: transparent'),
            'Store:mutation [cart]\n',
            'PluginSubscription'
        )
        expect(consoleSpy).toHaveBeenCalledWith(
            '%c%s',
            expect.stringContaining('color: #fafa05'),
            '[ mutation ]',
            'direct'
        )
    })

    it('writes error events to error', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createTraceGroupListener([{
            target: 'namespace', value: 'subscriber:execute',
        }], false)
        const failure = new Error('boom')

        listener.handler(createEvent({
            error: failure,
            level: 'error',
            namespace: 'subscriber:execute'
        }))

        expect(consoleSpy).toHaveBeenCalledWith(
            '%c%s',
            expect.stringContaining('background-color: #d24545'),
            'Store:mutation',
            'PluginSubscription'
        )
    })

    it('serializes array payloads inside the event object', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createConsoleGroupTraceListener()

        listener.handler(createEvent({ payload: ['first', 'second'] }))

        expect(consoleSpy).toHaveBeenCalledWith(
            '%c%s',
            expect.stringContaining('color: #fafa05'),
            '[ 0 ]',
            'first'
        )
        expect(consoleSpy).toHaveBeenCalledWith(
            '%c%s',
            expect.stringContaining('color: #fafa05'),
            '[ 1 ]',
            'second'
        )
    })

    it.each([
        ['equals', 'store:mutation', true],
        ['equals', 'store:action', false],
        ['contains', 'mutation', true],
        ['startsWith', 'store:', true],
        ['endsWith', ':mutation', true],
        ['unknown', 'store:mutation', false]
    ] as const)('filters namespace with the %s comparator', (comparator, value, expected) => {
        const listener = createTraceGroupListener([{
            target: 'namespace',
            comparator,
            value
        }])

        expect(listener.filter(createEvent())).toBe(expected)
    })

    it('rejects a criterion when its event value is not a string', () => {
        const listener = createTraceGroupListener([{
            target: 'scope',
            value: 'cart'
        }], false)

        expect(listener.filter(createEvent())).toBe(false)
    })

    it('matches any filter criterion when the some mode is selected', () => {
        const listener = createTraceGroupListener([
            { target: 'scope', value: 'cart' },
            { target: 'namespace', value: 'store:mutation' }
        ], false, 'some')

        expect(listener.filter(createEvent())).toBe(true)
    })

    it('includes plugin subscription namespace events when context is enabled', () => {
        const listener = createTraceGroupListener([{
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
        const listener = createTraceGroupListener([{
            target: 'namespace',
            value: 'unmatched'
        }], false)

        expect(listener.filter(createEvent())).toBe(false)
    })

    it('wraps array filters from listener definitions without mutating them', () => {
        const handler = vi.fn()
        const criteria = [{ target: 'namespace', value: 'store:mutation' }] as const
        const listenerDefinition = { handler, filter: criteria }
        const listener = createTraceGroupListener(listenerDefinition)

        expect(listener.filter).toBeTypeOf('function')
        expect(listener.filter(createEvent())).toBe(true)
        expect(listenerDefinition.filter).toBe(criteria)
        expect(listener.handler).toBe(handler)
    })

    it('preserves a custom filter from a listener definition', () => {
        const filter = vi.fn(() => true)
        const listener = createTraceGroupListener({ handler: vi.fn(), filter })

        expect(listener.filter).toBe(filter)
    })
})
