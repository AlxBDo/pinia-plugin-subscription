import type { TraceGroupId } from '../types/trace'

/**
 * Glossary of the `groupId` values emitted by `PluginSubscription`.
 * Each builder returns the group identifier of a store, so listeners can subscribe to it
 * and custom traces can join the same group.
 */
export const traceGroups: Record<TraceGroupId, (storeId: string) => string> = {
    onActionAfter: (storeId) => `store:onAction:after:${storeId}`,
    onActionError: (storeId) => `store:onAction:onError:${storeId}`,
    onMutation: (storeId) => `store:onMutation:${storeId}`,
    reset: (storeId) => `store:reset:${storeId}`
}
