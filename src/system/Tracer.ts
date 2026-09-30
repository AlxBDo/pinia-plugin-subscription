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
    private readonly _listeners: TraceListener[] = []
    private _scope?: string
    private readonly _source: string

    constructor(source: string, listeners: TraceListener[], options: TracerOptions = {}) {
        this._scope = options.scope
        this._source = source
        this._listeners = listeners
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

    /** Relays the error to matching listeners, or reports it when none match. */
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
        if (this._listeners.length === 0) {
            if (level === 'error') {
                console.error('Unhandled error trace event:', error)
            }
            return
        }

        const metadata: TraceEventMetadata = {
            level,
            namespace,
            scope: scope ?? this._scope,
            source: this._source
        }

        const matched = this._listeners.filter(listener => {
            if (!listener.filter) {
                return true
            }

            try {
                return listener.filter(metadata)
            } catch (error) {
                console.error('Error in trace listener filter:', error)
                return false
            }
        })

        if (matched.length === 0) {
            if (level === 'error') {
                console.error('Unhandled error trace event:', error)
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
            } catch (error) {
                // a faulty listener must never break the traced code
                console.error('Error in trace listener:', error)
            }
        }
    }
}
