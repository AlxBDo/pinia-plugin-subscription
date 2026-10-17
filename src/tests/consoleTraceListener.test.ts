import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsoleGroupTraceListener } from '../factories/console-trace-listener'
import { createTraceGroupListener } from '../factories/trace-listener'

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
})
