import type { AnyObject } from '../types'
import type {
    TraceEvent,
    TraceEventMetadata,
    TraceGroupListener,
    TraceLevel,
    TraceListener,
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
    private readonly _listeners: Array<TraceListener | TraceGroupListener> = []
    private readonly _redactor?: (payload: AnyObject) => AnyObject
    private _scope?: string
    private readonly _source: string

    constructor(source: string, listeners: Array<TraceListener | TraceGroupListener>, options: TracerOptions = {}) {
        this._redactor = options.redactor
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

    debug(label: string, namespace: string, payload?: TracePayload, scope?: string): void {
        this.emit('debug', label, namespace, payload, scope)
    }

    /** Relays the error to matching listeners, or reports it when none match. */
    error(label: string, namespace: string, error: unknown, payload?: TracePayload, scope?: string): void {
        this.emit('error', label, namespace, payload, scope, error)
    }

    private resolveAndRedact(payload: TracePayload): AnyObject | undefined {
        const resolved = resolvePayload(payload)

        if (!this._redactor || resolved === undefined) {
            return resolved
        }

        try {
            return this._redactor(resolved)
        } catch (error) {
            // never leak the raw payload when redaction fails
            return { __traceRedactionError: error instanceof Error ? error.message : String(error) }
        }
    }

    private matchListeners(level: TraceLevel, label: string, namespace: string, scope?: string) {
        const metadata: TraceEventMetadata = {
            label,
            level,
            namespace,
            scope: scope ?? this._scope,
            source: this._source
        }
        const matched: Array<TraceListener | TraceGroupListener> = []

        for (const listener of this._listeners) {
            try {
                if (listener.filter(metadata)) {
                    matched.push(listener)
                }
            } catch (error) {
                console.error('Error in trace listener filter:', error)
            }
        }

        return { matched, metadata }
    }

    private emit(
        level: TraceLevel,
        label: string,
        namespace: string,
        payload?: TracePayload,
        scope?: string,
        error?: unknown
    ): void {
        const { matched, metadata } = this._listeners.length === 0
            ? { matched: [], metadata: undefined }
            : this.matchListeners(level, label, namespace, scope)

        if (!metadata || matched.length === 0) {
            if (level === 'error') {
                console.error('Unhandled error trace event:', error)
            }
            return
        }

        const event: TraceEvent = {
            ...metadata,
            ...(error !== undefined && { error }),
            ...(payload !== undefined && { payload: this.resolveAndRedact(payload) }),
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
