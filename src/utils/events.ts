import { PLUGIN_PREFIX } from '../dictionaries/plugin-subscription-event'
import type { Store } from 'pinia'

export function defineStoreEventSubscriberId(prefix: string, store: Store): string {
    return `${prefix}-${store.$id}`
}

export function definePPSEventSubscriberId(store: Store): string {
    return defineStoreEventSubscriberId(PLUGIN_PREFIX, store)
}