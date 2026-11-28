import type { Store } from "pinia"
import type { TracePayload } from "./trace"

/** Reports traces on behalf of the owning `PluginSubscription` (label prefix and tracer are handled by the owner). */
export interface TraceReporter {
    trace(label: string, scope?: string, payload?: TracePayload): void
    traceError(label: string, error: unknown, scope?: string, payload?: TracePayload): void
}

/** Store events API of the owning `PluginSubscription`. */
export interface StoreEventsGateway {
    emit(store: Store, event: string, payload?: () => any): void
    hasEventSubscription(store: Store, eventName: string): boolean
}
