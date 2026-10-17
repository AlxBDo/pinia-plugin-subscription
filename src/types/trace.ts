import type { AnyObject } from './index'
import type Tracer from '../system/Tracer'

export interface AddTraceListenerOptions {
    context?: boolean
    filterMode?: TraceListenerFilterMode
    groupBy?: TraceListenerGroupBy
}

export interface ConsoleTraceEventArgs extends Omit<TraceEvent, 'level' | 'timestamp'> { }
export type ConsoleTraceEvent = Array<string | ConsoleTraceEventArgs>

/**
 * A trace listener that supports grouping of trace events.
 */
export interface ConsoleTraceGroupListener extends Omit<TraceListener, 'filter'> {
    createGroup: (key: string) => void
    logGroup: (key: string) => void
}

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
    /** Label describing the event, e.g. `Subscription:Delivery`. */
    label: string
    /** Severity of the trace event. */
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

type TraceFilterCriterionComparator = 'equals' | 'contains' | 'startsWith' | 'endsWith'

export interface TraceFilterCriterion {
    comparator: TraceFilterCriterionComparator
    target: keyof TraceEventMetadata
    value: string
}

export interface TraceFilterFactoryCriterion extends Omit<TraceFilterCriterion, 'comparator'> {
    comparator?: TraceFilterCriterionComparator
}

export type TraceFilterFactoryParam = {
    handler?: TraceHandler
    filter: TraceFilter | TraceFilterFactoryCriterion[]
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

export interface TraceGroupListener extends ConsoleTraceGroupListener, TraceListener {
    groupBy: TraceListenerGroupBy
}

/**
 * Handles a trace event.
 * @param event The resolved trace event to handle.
 */
export type TraceHandler = (event: TraceEvent) => void

export interface TraceListener {
    /** Evaluated on every event; return `true` to receive it. */
    filter: TraceFilter

    /** Handles the trace event when it passes the filter. */
    handler: TraceHandler
}

export type TraceListenerFilterMode = 'every' | 'some'

export type TraceListenerGroupBy = keyof TraceEventMetadata

/** Removes a previously registered listener. */
export type TraceListenerRemover = () => void

export type TraceRegistry = {
    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listener The trace listener to register.
     * @returns A function that removes the registered listener when called.
     */
    addTraceListener: (listener: TraceListener | TraceFilterFactoryParam, filterMode?: 'every' | 'some') => TraceListenerRemover

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

export interface TracerHandler {
    closeGroup: (payload: TraceEvent) => undefined,
    createTracer: (source: string) => Tracer,
    startGroup: (payload: TraceEvent) => undefined
}

export interface TracerOptions {
    scope?: string
}
