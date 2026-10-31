import type { AnyObject } from '../types'
import type {
    TraceEvent,
    TraceEventMetadata,
    TraceGroupListener,
    TraceJournal,
    TraceLevel,
    TraceListener,
    TracePayload,
    TraceSide,
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
    private readonly _journal?: TraceJournal
    private readonly _listeners: Array<TraceListener | TraceGroupListener> = []
    private readonly _redactor?: (payload: AnyObject) => AnyObject
    private _scope?: string
    private readonly _side: TraceSide
    private readonly _source: string

    constructor(source: string, listeners: Array<TraceListener | TraceGroupListener>, options: TracerOptions = {}) {
        this._journal = options.journal
        this._redactor = options.redactor
        this._side = options.side ?? 'client'
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

    private buildMetadata(level: TraceLevel, label: string, namespace: string, scope?: string): TraceEventMetadata {
        return {
            label,
            level,
            namespace,
            scope: scope ?? this._scope,
            source: this._source
        }
    }

    private matchListeners(metadata: TraceEventMetadata) {
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

        return matched
    }

    private emit(
        level: TraceLevel,
        label: string,
        namespace: string,
        payload?: TracePayload,
        scope?: string,
        error?: unknown
    ): void {
        if (this._listeners.length === 0 && !this._journal) {
            if (level === 'error') {
                console.error('Unhandled error trace event:', error)
            }
            return
        }

        const metadata = this.buildMetadata(level, label, namespace, scope)
        const matched = this._listeners.length ? this.matchListeners(metadata) : []

        if (matched.length === 0 && !this._journal) {
            if (level === 'error') {
                console.error('Unhandled error trace event:', error)
            }
            return
        }

        const resolved = payload !== undefined ? this.resolveAndRedact(payload) : undefined
        // `actionId` travels in the payload so that emitters need no extra argument, and is lifted to the event.
        const { actionId, ...rest } = resolved ?? {}
        const event: TraceEvent = {
            ...metadata,
            ...(typeof actionId === 'string' && { actionId }),
            ...(error !== undefined && { error }),
            ...(resolved !== undefined && { payload: typeof actionId === 'string' ? rest : resolved }),
            ...(this._journal && { seq: this._journal.nextSeq(), side: this._side }),
            timestamp: Date.now()
        }

        this._journal?.append(event)

        if (matched.length === 0 && level === 'error') {
            console.error('Unhandled error trace event:', error)
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
