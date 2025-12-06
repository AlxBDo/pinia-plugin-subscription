import pluginSubscription from "./pluginCreation"

import type { PiniaPlugin } from "pinia"
import type { PluginSubscriber } from "../types/plugin"
import type { StoreOptions } from "../types/store"

export function createPlugin(subscribers: PluginSubscriber[], debug: boolean = false): PiniaPlugin {
    if (typeof debug !== 'boolean') {
        debug = false
    }

    pluginSubscription.debug = debug
    pluginSubscription.subscribers = subscribers

    return pluginSubscription.plugin.bind(pluginSubscription)
}

declare module 'pinia' {
    export interface PiniaCustomProperties {
    }

    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}