import type { StoreOptions } from "pinia-plugin-subscription"

export interface DemoPluginOptions extends StoreOptions {
    active: boolean
}