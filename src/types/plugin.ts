import type { PiniaPluginContext, Store } from "pinia"


export interface CreatePluginOptions {
    dbName?: string
    cryptKey?: string
    debug?: boolean
}

export interface PluginSubscriber {
    invoke: (context: PiniaPluginContext, debug?: boolean) => void
    resetStoreCallback?: (store?: Store) => void
}