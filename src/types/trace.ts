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
    /** Identifier for the group this event belongs to. */
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
    timestamp: number
}

/** Names of the trace groups emitted by `PluginSubscription`, see `traceGroups`. */
export type TraceGroupId = 'onActionAfter' | 'onActionError' | 'onMutation' | 'reset'

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

export interface TraceGroupListener extends ConsoleTraceGroupListener, Pick<TraceListener, 'filter'> {
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
     * @param listenerDef The listener definition or filter criteria.
     * @param options Context, filter mode and grouping options.
     * @returns A function that removes the registered listener when called.
     */
    addListener: (
        listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
        options?: AddTraceListenerOptions
    ) => TraceListenerRemover

    /**
     * Registers a listener for the specified scopes and returns its remover.
     * @param scopes The scopes to listen for.
     * @param context Whether to print the plugin context to the console. Defaults to true.
     * @returns A function that removes the registered listener when called.
     */
    addScopesListener: (scopes: string[], context?: boolean) => TraceListenerRemover

    /**
     * Clears all registered trace listeners.
     */
    clearTraceListeners: () => void

    /**
     * Checks if there are any registered trace listeners.
     * @returns True if there are registered trace listeners, otherwise false.
     */
    hasTraceListeners: () => boolean

    /** Handler to pass to the plugin through `PluginSubscriptionOptions.tracerHandler`. */
    tracerHandler: TracerHandler
}

export interface TracerHandler {
    /** Flushes the group of the event's group key to the matching listeners. */
    closeGroup: (payload: TraceEvent) => void
    /**
     * Creates a new tracer instance.
     * @param source The source of the tracer, usually the class name.
     * @param options Optional tracer options.
     */
    createTracer: (source: string, options?: TracerOptions) => Tracer
    /** Reports whether this handler currently has any registered trace listeners. */
    hasTraceListeners?: () => boolean
    /** Opens a group for the event's group key on the matching listeners. */
    startGroup: (payload: TraceEvent) => void
}

export interface TraceRedactOptions {
    /** Replaces the default key list instead of extending it when `false`. Defaults to `true`. */
    includeDefaults?: boolean
    /** Additional keys to mask: strings match exactly (case-insensitive), regular expressions match anywhere in the key. */
    keys?: Array<string | RegExp>
    /** Value substituted for masked values. Defaults to `[REDACTED]`. */
    replacement?: string
}

export interface TracerRegistryOptions {
    /**
     * Whether listeners can be registered. When `false`, `addListener()` is a no-op and tracing stays inactive.
     * Defaults to `false` in production builds (`process.env.NODE_ENV === 'production'`), `true` otherwise.
     */
    enabled?: boolean
    /**
     * Masks sensitive values (passwords, tokens, secrets...) of event payloads before they reach any listener.
     * Opt-in: `true` uses the default key list, an object customizes it. Redaction works on a copy.
     */
    redact?: boolean | TraceRedactOptions
}

export interface TracerOptions {
    /** Transforms the resolved payload before it is delivered to listeners. */
    redactor?: (payload: AnyObject) => AnyObject
    scope?: string
}
