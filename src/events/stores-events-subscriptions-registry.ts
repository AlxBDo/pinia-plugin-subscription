import { Store } from "pinia";

/**
 * Registry for managing store event subscriptions.
 */
export default class StoresEventsSubscriptionsRegistry {
    private subscriptions: Map<Store, Set<string>> = new Map();


    /**
     * Adds a subscription for the given store and event.
     * @param store The store to add the subscription for.
     * @param event The event to subscribe to.
     */
    public add(store: Store, event: string): void {
        if (!this.subscriptions.has(store)) {
            this.subscriptions.set(store, new Set());
        }
        this.subscriptions.get(store)!.add(event);
    }

    /**
     * Clears all subscriptions for the given store, or all subscriptions if no store is specified.
     * @param store The store to clear subscriptions for, or undefined to clear all subscriptions.
     */
    public clear(store?: Store): void {
        if (store) {
            this.subscriptions.delete(store);
        } else {
            this.subscriptions.clear();
        }
    }

    /**
     * Checks if a subscription exists for the given store and event.
     * @param store The store to check the subscription for.
     * @param event The event to check the subscription for.
     * @returns True if the subscription exists, false otherwise.
     */
    public has(store: Store, event: string): boolean {
        return this.subscriptions.has(store) && this.subscriptions.get(store)!.has(event);
    }

    /**
     * Removes a subscription for the given store and event.
     * @param store The store to remove the subscription for.
     * @param event The event to unsubscribe from.
     */
    public remove(store: Store, event: string): void {
        if (this.subscriptions.has(store)) {
            this.subscriptions.get(store)!.delete(event);
            if (this.subscriptions.get(store)!.size === 0) {
                this.subscriptions.delete(store);
            }
        }
    }
}