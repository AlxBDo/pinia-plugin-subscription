import {
    StoreEventsSubscriber
} from 'pinia-plugin-subscription/helpers'
import { STORE_EVENTS_SUBSCRIBER_ID_PREFIX } from '../utils/constants'

import type { Store } from 'pinia'


class SnapshotEventsSubscriber extends StoreEventsSubscriber {
    constructor(
        store: Store,
        subscriptions: Record<string, (...args: any[]) => void> | undefined,
        private readonly onClear?: () => void
    ) {
        super(getStoreEventSubscriberId(store), store, subscriptions)
    }

    clear(): void {
        super.clear()
        this.onClear?.()
    }
}

/**
 * Creates a new StoreEventsSubscriber for the given store.
 * @param store The Pinia store instance.
 * @param eventSubscriptions Optional event subscriptions for the store.
 * @param onClear Optional callback invoked when the subscriber is cleared.
 * @returns A new StoreEventsSubscriber instance.
 */
export function createStoreEventsSubscriber(
    store: Store,
    eventSubscriptions?: Record<string, (...args: any[]) => void>,
    onClear?: () => void
): StoreEventsSubscriber {
    return new SnapshotEventsSubscriber(store, eventSubscriptions, onClear)
}

function getStoreEventSubscriberId(store: Store): string {
    return `${STORE_EVENTS_SUBSCRIBER_ID_PREFIX}${store.$id}`
}