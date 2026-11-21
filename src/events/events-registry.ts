import EventsEmitter from "./events-emitter"
import StoreEventsSubscriber from "./store-events-subscriber"
import { STORE } from "../dictionaries/plugin-subscription-event"

import type { Store } from "pinia"

/**
 * Abstract class for handling store events.
 */
export default abstract class EventsRegistry extends EventsEmitter {
    private addEventStoreDisposeSubscriber(id: string, store: Store, callback?: (store: Store) => void) {
        if (!callback) {
            return
        }

        this.addEventStoreSubscription(
            id,
            store,
            {
                [STORE.DISPOSE]: () => {
                    try {
                        callback.call(this, store)
                    } catch (error) {
                        this.traceError('store:onDispose:failed', error, store.$id)
                    }
                }
            }
        )
    }

    /**
     * Adds an event store subscriber.
     * @param subscriber The store events subscriber to add.
     */
    protected addEventStoreSubscriber(subscriber: StoreEventsSubscriber): void {
        this._storeEventsSubscribersHandler?.subscribe(subscriber.storeId as string, subscriber)
        this.trace(
            `eventsStore:subscribed`,
            subscriber.storeId
        )
    }

    /**
     * Adds an event store subscription.
     * @param id The ID of the subscription.
     * @param store The Pinia store to subscribe to.
     * @param subscriptions The subscription callbacks.
     */
    protected addEventStoreSubscription(
        id: string,
        store: Store,
        subscriptions: Record<string, (...args: any[]) => void>
    ): void {
        this.addEventStoreSubscriber(new StoreEventsSubscriber(id, store, subscriptions))
    }

    protected onDispose(store: Store): void { }

    protected onStoreDispose(store: Store) {
        if (typeof this.onDispose === "function") {
            this.addEventStoreDisposeSubscriber(store.$id, store, this.onDispose)
        }
    }
}