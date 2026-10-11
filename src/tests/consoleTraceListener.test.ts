import { describe, expect, it, vi } from 'vitest'
import { createConsoleTraceListener } from '../factories/console-trace-listener'
import { createTraceListener } from '../factories/trace-listener'

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

describe('createConsoleTraceListener', () => {
    it('uses the styled plugin console when no target is supplied', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
        const listener = createTraceListener([{
            target: 'namespace', value: 'store:mutation',
        }])

        listener.handler(createEvent())

        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('writes debug events to log', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createTraceListener({
            handler: createConsoleTraceListener(target).handler,
            filter: [{
                target: 'scope', value: 'cart',
            }]
        })

        listener.handler(createEvent({
            payload: { mutation: 'direct' },
            scope: 'cart'
        }))

        expect(target.log).toHaveBeenCalledWith(
            'Store:mutation [cart]',
            expect.objectContaining({
                label: 'Store:mutation',
                namespace: 'store:mutation',
                scope: 'cart',
                source: 'PluginSubscription',
                payload: { mutation: 'direct' }
            })
        )
        expect(target.error).not.toHaveBeenCalled()
    })

    it('writes error events to error', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createTraceListener({
            handler: createConsoleTraceListener(target).handler,
            filter: [{
                target: 'namespace', value: 'subscriber:execute',
            }]
        })
        const failure = new Error('boom')

        listener.handler(createEvent({
            error: failure,
            level: 'error',
            namespace: 'subscriber:execute'
        }))

        expect(target.error).toHaveBeenCalledWith(
            'Store:mutation',
            expect.objectContaining({
                label: 'Store:mutation',
                namespace: 'subscriber:execute',
                source: 'PluginSubscription',
                error: failure
            })
        )
        expect(target.log).not.toHaveBeenCalled()
    })

    it('serializes array payloads inside the event object', () => {
        const target = { log: vi.fn(), error: vi.fn() }
        const listener = createConsoleTraceListener(target)

        listener.handler(createEvent({ payload: ['first', 'second'] }))

        expect(target.log).toHaveBeenCalledWith(
            'Store:mutation',
            expect.objectContaining({
                label: 'Store:mutation',
                namespace: 'store:mutation',
                source: 'PluginSubscription',
                payload: ['first', 'second']
            })
        )
    })
})
