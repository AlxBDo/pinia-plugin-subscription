import type { AnyObject } from './index'

/**
 * Severity of a trace event.
 * `error` events are delivered to matching listeners, or rethrown when none match.
 */
export type TraceLevel = 'debug' | 'error'

/**
 * Cheap descriptor of an event, built before the payload is resolved.
 * Filters receive this object so that discarded events never allocate a payload.
 */
export interface TraceEventMetadata {
    level: TraceLevel
    /** Structured, colon separated identifier, e.g. `subscription:delivery`. */
    namespace: string
    /** Instance the event belongs to, usually a Pinia `store.$id`. */
    scope?: string
    /** Emitting class name, e.g. `PluginSubscription`. */
    source: string
}

/**
 * A resolved trace event, handed over to listeners.
 */
export interface TraceEvent extends TraceEventMetadata {
    error?: unknown
    payload?: AnyObject
    timestamp: number
}

/**
 * Event data. Prefer the function form: it is only invoked when a listener
 * actually consumes the event, keeping unobserved tracing allocation free.
 */
export type TracePayload = AnyObject | (() => AnyObject)

export type TraceFilter = (event: TraceEventMetadata) => boolean

export type TraceHandler = (event: TraceEvent) => void

export interface TraceListener {
    /** Evaluated on every event; return `true` to receive it. Omit to receive all. */
    filter?: TraceFilter
    handler: TraceHandler
}

/** Removes a previously registered listener. */
export type TraceListenerRemover = () => void

export interface TracerOptions {
    scope?: string
}
