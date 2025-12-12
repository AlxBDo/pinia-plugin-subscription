import type { PiniaPluginContext, Store } from "pinia"


export interface PluginSubscriber {
    invoke: (context: PiniaPluginContext, debug?: boolean) => void
    resetStoreCallback?: (store?: Store) => void
}