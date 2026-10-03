import type { AnyObject } from './index'
import type Tracer from '../system/Tracer'

/**
 * Severity of a trace event.
 * `error` events are delivered to matching listeners, or reported with `console.error` when none match.
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

/**
 * Determines whether a trace event should be delivered to a listener.
 * @param event The metadata of the trace event.
 * @returns `true` if the event should be delivered to the listener, otherwise `false`.
 */
export type TraceFilter = (event: TraceEventMetadata) => boolean

/**
 * Handles a trace event.
 * @param event The resolved trace event to handle.
 */
export type TraceHandler = (event: TraceEvent) => void

export interface TraceListener {
    /** Evaluated on every event; return `true` to receive it. Omit to receive all. */
    filter?: TraceFilter

    /** Handles the trace event when it passes the filter. */
    handler: TraceHandler
}

/** Removes a previously registered listener. */
export type TraceListenerRemover = () => void

export type TraceRegistry = {
    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listener The trace listener to register.
     * @returns A function that removes the registered listener when called.
     */
    addTraceListener: (listener: TraceListener) => TraceListenerRemover

    /**
     * Clears all registered trace listeners.
     */
    clearTraceListeners: () => void

    /**
     * Creates a new tracer instance.
     * @param source The source of the tracer, usually the class name.
     * @param options Optional tracer options.
     * @returns A new tracer instance.
     */
    createTracer: (source: string, options?: TracerOptions) => Tracer

    /**
     * Checks if there are any registered trace listeners.
     * @returns True if there are registered trace listeners, otherwise false.
     */
    hasTraceListeners: () => boolean
}

export interface TracerOptions {
    scope?: string
}
