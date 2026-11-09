import PluginSubscription from "../core/PluginSubscription"

import type { PiniaPlugin } from "pinia"
import type { PluginSubscriber, PluginSubscriptionOptions } from "../types/plugin"
import type { StoreOptions } from "../types/store"

/**
 * Creates a Pinia plugin that manages the specified plugin subscribers.
 *
 * @param subscribers The list of plugin subscribers to be used by the plugin.
 * @param options The options for configuring the plugin subscription.
 * @returns A Pinia plugin that handles the provided subscribers and options.
 */
export function createPlugin(
    subscribers: PluginSubscriber[],
    options?: PluginSubscriptionOptions
): PiniaPlugin {
    const pluginSubscription = new PluginSubscription(subscribers, options)

    return pluginSubscription.plugin.bind(pluginSubscription)
}

declare module 'pinia' {
    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}