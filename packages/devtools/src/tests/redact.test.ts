import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTracerRegistry } from '../factories/trace-registry'
import { createRedactor, DEFAULT_REDACTED_VALUE } from '../utils/redact'

import type { TraceEvent } from '../types/trace'

function trace(registryOptions: Parameters<typeof createTracerRegistry>[0], payload: Record<string, unknown>) {
    const registry = createTracerRegistry({ enabled: true, ...registryOptions })
    const events: TraceEvent[] = []
    registry.addListener({ filter: () => true, handler: event => { events.push(event) } })
    registry.tracerHandler.createTracer('Source').debug('Label', 'ns', () => payload)
    return events[0]?.payload
}

describe('redaction', () => {
    afterEach(() => vi.restoreAllMocks())

    describe('createRedactor', () => {
        it('masks default sensitive keys at any depth', () => {
            const redact = createRedactor()

            const result = redact({
                user: { name: 'ada', password: 'p', profile: { accessToken: 'abc', nested: [{ apiKey: 'k' }] } },
                Authorization: 'Bearer x'
            })

            expect(result).toEqual({
                user: {
                    name: 'ada',
                    password: DEFAULT_REDACTED_VALUE,
                    profile: { accessToken: DEFAULT_REDACTED_VALUE, nested: [{ apiKey: DEFAULT_REDACTED_VALUE }] }
                },
                Authorization: DEFAULT_REDACTED_VALUE
            })
        })

        it('does not mask unrelated keys', () => {
            expect(createRedactor()({ name: 'ada', count: 1, passenger: 'x' }))
                .toEqual({ name: 'ada', count: 1, passenger: 'x' })
        })

        it('supports custom keys (exact string, regexp) and replacement', () => {
            const redact = createRedactor({ keys: ['iban', /^ssn/i], replacement: '***' })

            expect(redact({ IBAN: '1', ssnNumber: '2', password: '3', ok: 4 }))
                .toEqual({ IBAN: '***', ssnNumber: '***', password: '***', ok: 4 })
        })

        it('can drop the default keys', () => {
            const redact = createRedactor({ includeDefaults: false, keys: ['iban'] })

            expect(redact({ password: 'visible', iban: 'hidden' }))
                .toEqual({ password: 'visible', iban: DEFAULT_REDACTED_VALUE })
        })

        it('never mutates the original payload', () => {
            const original = { state: { token: 'abc' }, list: [{ secret: 's' }] }

            createRedactor()(original)

            expect(original).toEqual({ state: { token: 'abc' }, list: [{ secret: 's' }] })
        })

        it('copies an own __proto__ key without changing the result prototype', () => {
            const original = Object.defineProperty({}, '__proto__', {
                configurable: true,
                enumerable: true,
                value: { token: 'secret' },
                writable: true
            })

            const result = createRedactor()(original)

            expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
            expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true)
            expect((result as Record<string, unknown>)['__proto__']).toEqual({ token: DEFAULT_REDACTED_VALUE })
        })

        it('handles circular references, null and non-plain values', () => {
            const circular: Record<string, unknown> = { name: 'loop', value: null }
            circular.self = circular
            const date = new Date()

            const result = createRedactor()({ circular, date, fn: () => 1 }) as any

            expect(result.circular.self).toBe(result.circular)
            expect(result.circular.value).toBeNull()
            expect(result.date).toBe(date)
            expect(typeof result.fn).toBe('function')
        })

        it('redacts Map and Set content', () => {
            const result = createRedactor()({
                map: new Map<string, unknown>([['token', 'a'], ['id', { password: 'b' }]]),
                set: new Set([{ secret: 'c' }])
            }) as any

            expect(result.map.get('token')).toBe(DEFAULT_REDACTED_VALUE)
            expect(result.map.get('id')).toEqual({ password: DEFAULT_REDACTED_VALUE })
            expect([...result.set]).toEqual([{ secret: DEFAULT_REDACTED_VALUE }])
        })

        it('is not affected by global regexp state', () => {
            const redact = createRedactor({ includeDefaults: false, keys: [/pin/g] })

            expect(redact({ pin: 1, pinCode: 2 })).toEqual({
                pin: DEFAULT_REDACTED_VALUE,
                pinCode: DEFAULT_REDACTED_VALUE
            })
        })

        it('stops at a maximum depth', () => {
            let deep: Record<string, unknown> = { leaf: true }
            for (let i = 0; i < 30; i++) deep = { child: deep }

            expect(JSON.stringify(createRedactor()(deep))).toContain('[MaxDepth]')
        })
    })

    describe('registry option', () => {
        it('leaves payloads untouched by default', () => {
            expect(trace({}, { token: 'abc' })).toEqual({ token: 'abc' })
        })

        it('redacts payloads delivered to listeners when enabled', () => {
            expect(trace({ redact: true }, { token: 'abc', id: 1 }))
                .toEqual({ token: DEFAULT_REDACTED_VALUE, id: 1 })
        })

        it('accepts a custom configuration', () => {
            expect(trace({ redact: { keys: ['id'], replacement: 'x' } }, { token: 'abc', id: 1 }))
                .toEqual({ token: 'x', id: 'x' })
        })

        it('does not leak the raw payload when redaction fails', () => {
            const registry = createTracerRegistry({ enabled: true, redact: true })
            const events: TraceEvent[] = []
            registry.addListener({ filter: () => true, handler: event => { events.push(event) } })
            const hostile = {
                get boom(): never { throw new Error('getter failed') },
                token: 'abc'
            }

            registry.tracerHandler.createTracer('Source').debug('Label', 'ns', () => hostile)

            expect(events[0]?.payload).toEqual({ __traceRedactionError: 'getter failed' })
        })
    })
})
