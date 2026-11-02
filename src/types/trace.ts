import type { AnyObject } from './index'

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
    /** Identifier of the store action this event belongs to, shared by every event of the same action. */
    actionId?: string
    /**
     * Group (lifecycle) this event belongs to. It is a `/` separated path whose prefixes are the parent groups,
     * e.g. `cart/onAction:add#3/after`, see `traceGroups`.
     */
    groupId?: string
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
    /** Monotonic position of the event in its registry. Set when a journal is enabled. */
    seq?: number
    /** Environment that emitted the event. Set when a journal is enabled. */
    side?: TraceSide
    timestamp: number
}

/** Environment that emitted a trace event. */
export type TraceSide = 'client' | 'server'

/**
 * Event data. Prefer the function form: it is only invoked when a listener
 * actually consumes the event, keeping unobserved tracing allocation free.
 */
export type TracePayload = AnyObject | (() => AnyObject)

/**
 * Handles a trace event.
 * @param event The resolved trace event to handle.
 */
export type TraceHandler = (event: TraceEvent) => void

/**
 * Emits structured trace events. Implemented by tracing packages such as `pinia-plugin-subscription-devtools`.
 * The plugin only emits: it never reads, stores or displays events.
 */
export interface Tracer {
    /** Instance the emitted events belong to, usually a Pinia `store.$id`. */
    scope?: string
    readonly source: string
    debug: (label: string, namespace: string, payload?: TracePayload, scope?: string) => void
    error: (label: string, namespace: string, error: unknown, payload?: TracePayload, scope?: string) => void
}

/**
 * Contract between the plugin and a tracing package, passed through `PluginSubscriptionOptions.tracerHandler`.
 * Without a handler, tracing is inactive and costs nothing.
 */
export interface TracerHandler {
    /** Closes the group of the event's group key. */
    closeGroup: (payload: TraceEvent) => void
    /**
     * Creates a new tracer instance.
     * @param source The source of the tracer, usually the class name.
     */
    createTracer: (source: string) => Tracer
    /** Reports whether this handler currently consumes events. Lets the plugin skip building them when `false`. */
    hasTraceListeners?: () => boolean
    /** Opens a group for the event's group key. */
    startGroup: (payload: TraceEvent) => void
}
