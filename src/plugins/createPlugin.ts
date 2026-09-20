import PluginSubscription from "../core/PluginSubscription"

import type { PiniaPlugin } from "pinia"
import type { PluginSubscriber } from "../types/plugin"
import type { RollbackActionParams, StoreOptions } from "../types/store"

export function createPlugin(subscribers: PluginSubscriber[], debug?: string[]): PiniaPlugin {
    const pluginSubscription = new PluginSubscription(subscribers, debug)

    return pluginSubscription.plugin.bind(pluginSubscription)
}

declare module 'pinia' {
    export interface PiniaCustomProperties {
        /**
         * Executes an action and restores the previous state snapshot if it fails.
         * Added to every store when the plugin is active.
         *
         * @param params The action name and the state keys to snapshot.
         * @param args The action arguments, passed as a single array (forwarded via `apply`).
         */
        $rollbackAfterFailure: (params: RollbackActionParams, args?: any[]) => Promise<void>
    }

    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}