import type { TraceEvent } from '../types/trace'

/** Context events describe a store (state, subscribers, options) and are emitted when a store is set up. */
export function isContextEvent(event: Pick<TraceEvent, 'namespace'>): boolean {
    return event.namespace.endsWith(':context')
}
