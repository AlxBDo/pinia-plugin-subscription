/**
 * Glossary of the `groupId` values emitted by `PluginSubscription`.
 * A group id is a `/` separated path: its prefixes are the parent groups (lifecycles), so
 * `after` and `onError` are sub-groups of their `onAction` call.
 * Listeners can subscribe to these ids and custom traces can join the same group.
 */
const onAction = (storeId: string, actionName: string, callId: number) => `${storeId}/onAction:${actionName}#${callId}`
const plugin = (storeId: string) => `${storeId}/plugin`

export const traceGroups = {
    onAction,
    onActionAfter: (storeId: string, actionName: string, callId: number) => `${onAction(storeId, actionName, callId)}/after`,
    onActionError: (storeId: string, actionName: string, callId: number) => `${onAction(storeId, actionName, callId)}/onError`,
    onMutation: (storeId: string, callId: number) => `${storeId}/onMutation#${callId}`,
    plugin,
    pluginDeferred: (storeId: string, subscriberName: string, callId: number) => `${plugin(storeId)}/deferred:${subscriberName}#${callId}`,
    reset: (storeId: string, callId: number) => `${storeId}/reset#${callId}`
}
