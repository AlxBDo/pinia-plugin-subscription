import PluginSubscription from "./pluginSubscription"

import type { PiniaPlugin } from "pinia"
import type { PluginSubscriber } from "../types/plugin"
import type { StoreOptions } from "../types/store"

export function createPlugin(subscribers: PluginSubscriber[], debug: boolean = false): PiniaPlugin {
    if (typeof debug !== 'boolean') {
        debug = false
    }

    const pluginSubscription = new PluginSubscription(subscribers, debug)

    return pluginSubscription.plugin.bind(pluginSubscription)
}

declare module 'pinia' {
    export interface PiniaCustomProperties {
    }

    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}