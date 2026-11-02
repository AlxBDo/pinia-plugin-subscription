/** Name of the plugin emitting the events, as reported in their `source`. */
export const pluginName: string = 'pinia-plugin-subscription'
/** Prefix of every namespace emitted by `PluginSubscription`: its class name, lowercased. */
export const pluginSubscriptionNamespace: string = 'pluginsubscription'
/** Journal scope of the events emitted without a store. */
export const journalGlobalScope: string = '__global__'
