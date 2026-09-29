import type { AnyObject } from '../types'
import type {
    TraceEvent,
    TraceEventMetadata,
    TraceLevel,
    TraceListener,
    TraceListenerRemover,
    TracePayload,
    TracerOptions,
} from '../types/trace'

const listeners: TraceListener[] = []

/**
 * Registers a trace listener and returns its remover.
 * Listeners are evaluated in registration order.
 */
export function addTraceListener(listener: TraceListener): TraceListenerRemover {
    listeners.push(listener)

    return () => {
        const index = listeners.indexOf(listener)

        if (index !== -1) {
            listeners.splice(index, 1)
        }
    }
}

export function clearTraceListeners(): void {
    listeners.length = 0
}

export function hasTraceListeners(): boolean {
    return listeners.length > 0
}

function resolvePayload(payload: TracePayload): AnyObject | undefined {
    if (typeof payload !== 'function') {
        return payload
    }

    try {
        return payload()
    } catch (error) {
        return { __tracePayloadError: error }
    }
}

/**
 * Emits structured trace events.
 *
 * Nothing is allocated when no listener matches:
 * the payload is a factory resolved only once a consumer is known.
 */
export default class Tracer {
    private _scope?: string
    private readonly _source: string

    constructor(source: string, options: TracerOptions = {}) {
        this._scope = options.scope
        this._source = source
    }

    get scope(): string | undefined {
        return this._scope
    }

    set scope(scope: string | undefined) {
        this._scope = scope
    }

    get source(): string {
        return this._source
    }

    debug(namespace: string, payload?: TracePayload, scope?: string): void {
        this.emit('debug', namespace, payload, scope)
    }

    /** Relays the error to matching listeners, or rethrows it when none match. */
    error(namespace: string, error: unknown, payload?: TracePayload, scope?: string): void {
        this.emit('error', namespace, payload, scope, error)
    }

    private emit(
        level: TraceLevel,
        namespace: string,
        payload?: TracePayload,
        scope?: string,
        error?: unknown
    ): void {
        if (listeners.length === 0) {
            if (level === 'error') {
                throw error
            }
            return
        }

        const metadata: TraceEventMetadata = {
            level,
            namespace,
            scope: scope ?? this._scope,
            source: this._source
        }

        const matched = listeners.filter(listener => {
            if (!listener.filter) {
                return true
            }

            try {
                return listener.filter(metadata)
            } catch {
                return false
            }
        })

        if (matched.length === 0) {
            if (level === 'error') {
                throw error
            }
            return
        }

        const event: TraceEvent = {
            ...metadata,
            ...(error !== undefined && { error }),
            ...(payload !== undefined && { payload: resolvePayload(payload) }),
            timestamp: Date.now()
        }

        for (const listener of matched) {
            try {
                listener.handler(event)
            } catch {
                // a faulty listener must never break the traced code
            }
        }
    }
}
