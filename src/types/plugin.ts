import type { PiniaPluginContext } from "pinia"


export interface CreatePluginOptions {
    dbName?: string
    cryptKey?: string
    debug?: boolean
}

export interface PluginSubscriber {
    invoke: (context: PiniaPluginContext, debug?: boolean) => void
}