import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestTracerRegistry } from './support/testTracer'
import TraceEmitter from '../system/TraceEmitter'

import type { Tracer } from '../types/trace'
import type { TraceEvent } from '../types/trace'

class Emitter extends TraceEmitter {
    protected _className = 'Emitter'

    constructor(tracer?: Tracer) {
        super()
        this._tracer = tracer
    }
}

function setup() {
    const registry = createTestTracerRegistry()
    const events: TraceEvent[] = []
    registry.addListener({ filter: () => true, handler: event => { events.push(event) } })
    return { emitter: new Emitter(registry.tracerHandler.createTracer('Source')), events }
}

describe('TraceEmitter', () => {
    afterEach(() => vi.restoreAllMocks())

    it('prefixes the label with the class name by default', () => {
        const { emitter, events } = setup()

        emitter.trace('created', 'scope')

        expect(events[0]).toMatchObject({ label: 'Emitter:created', namespace: 'emitter:created', scope: 'scope' })
    })

    it('does not prefix the label when the class name is disabled', () => {
        const { emitter, events } = setup()
        emitter.classNameAddedToTraceNamespace = false

        emitter.trace('created')

        expect(events[0]?.label).toBe('created')
    })

    it('uses the explicit namespace when provided', () => {
        const { emitter, events } = setup()

        emitter.trace('created', undefined, undefined, 'custom:ns')

        expect(events[0]?.namespace).toBe('custom:ns')
    })

    it('emits error events', () => {
        const { emitter, events } = setup()
        const error = new Error('boom')

        emitter.traceError('failed', error)

        expect(events[0]).toMatchObject({ error, level: 'error' })
    })

    it('reports errors with console.error when tracing is disabled', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const error = new Error('boom')

        new Emitter().traceError('failed', error)

        expect(spy).toHaveBeenCalledWith(error)
    })
})
