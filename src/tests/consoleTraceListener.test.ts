import { describe, expect, it, vi } from 'vitest'
import { createConsoleTraceListener } from '../system/createConsoleTraceListener'

import type { TraceEvent } from '../types/trace'

function createEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
    return {
        level: 'debug',
        namespace: 'store:mutation',
        source: 'PluginSubscription',
        timestamp: 1,
        ...overrides
    }
}

describe('createConsoleTraceListener', () => {
    it('uses the styled plugin console when no target is supplied', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createConsoleTraceListener()

        listener.handler(createEvent())

        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('writes debug events to log', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createConsoleTraceListener(target)

        listener.handler(createEvent({
            payload: { mutation: 'direct' },
            scope: 'cart'
        }))

        expect(target.log).toHaveBeenCalledWith(
            'PluginSubscription - store:mutation [cart]',
            { mutation: 'direct' }
        )
        expect(target.error).not.toHaveBeenCalled()
    })

    it('writes error events to error', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createConsoleTraceListener(target)
        const failure = new Error('boom')

        listener.handler(createEvent({
            error: failure,
            level: 'error',
            namespace: 'subscriber:execute'
        }))

        expect(target.error).toHaveBeenCalledWith(
            'PluginSubscription - subscriber:execute',
            failure
        )
        expect(target.log).not.toHaveBeenCalled()
    })

    it('spreads array payloads as console arguments', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createConsoleTraceListener(target)

        listener.handler(createEvent({ payload: ['first', 'second'] }))

        expect(target.log).toHaveBeenCalledWith(
            'PluginSubscription - store:mutation',
            'first',
            'second'
        )
    })
})
