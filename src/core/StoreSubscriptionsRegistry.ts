import { getStoreInstanceKeyPrefix, getStoreInstanceScopedKey } from "../utils/store"

import type { Store } from "pinia"
import type { AnyObject } from "../types"
import type {
    StoreMutationSubscriptionCallback,
    StoreOnActionAfterCallbackParameter,
    StoreOnActionSubscriptionCallback
} from "../types/plugin"

export interface StoreCleanupHandlers {
    onDispose: (store: Store) => void
    onError: (error: unknown, store: Store) => void
}

/** Holds the per-store onAction/onMutation subscriptions and the per-action after/onError callbacks. */
export default class StoreSubscriptionsRegistry {
    private _afterCallbacks: Record<string, StoreOnActionAfterCallbackParameter[]> = {}
    private _disposedStores: WeakSet<Store> = new WeakSet()
    private _errorCallbacks: Record<string, Array<(error: unknown) => void>> = {}
    private _mutationSubscriptions: Map<Store, Set<StoreMutationSubscriptionCallback>> = new Map()
    private _mutationTraces: Map<Store, string[]> = new Map()
    private _mutationUnsubscribes: Map<Store, () => void> = new Map()
    private _onActionStores: WeakSet<Store> = new WeakSet()
    private _onActionSubscriptions: Map<Store, Set<StoreOnActionSubscriptionCallback>> = new Map()
    private _onActionTraces: Map<Store, string[]> = new Map()

    addOnActionAfterCallback(actionName: string, store: Store, callback: StoreOnActionAfterCallbackParameter): void {
        const key = getStoreInstanceScopedKey(actionName, store)
        ; (this._afterCallbacks[key] ??= []).push(callback)
    }

    addOnActionOnErrorCallback(actionName: string, store: Store, callback: (error: unknown) => void): void {
        const key = getStoreInstanceScopedKey(actionName, store)
        ; (this._errorCallbacks[key] ??= []).push(callback)
    }

    addOnActionSubscription(store: Store, callback: StoreOnActionSubscriptionCallback, subscriberName: string): void {
        if (!this._onActionSubscriptions.has(store)) {
            this._onActionSubscriptions.set(store, new Set())
        }
        this._onActionSubscriptions.get(store)!.add(callback)
        this._onActionTraces.get(store)?.push(subscriberName)
    }

    addMutationSubscription(store: Store, callback: StoreMutationSubscriptionCallback, subscriberName: string): void {
        if (!this._mutationSubscriptions.has(store)) {
            this._mutationSubscriptions.set(store, new Set())
        }
        this._mutationSubscriptions.get(store)!.add(callback)
        this._mutationTraces.get(store)?.push(subscriberName)
    }

    clearOnActionCallbacks(storageKey: string): void {
        delete this._afterCallbacks[storageKey]
        delete this._errorCallbacks[storageKey]
    }

    clearStore(store: Store): void {
        this._onActionSubscriptions.delete(store)
        this._onActionStores.delete(store)
        this._mutationUnsubscribes.get(store)?.()
        this._mutationUnsubscribes.delete(store)
        this._mutationSubscriptions.delete(store)
        this._onActionTraces.delete(store)
        this._mutationTraces.delete(store)
        const keyPrefix = getStoreInstanceKeyPrefix(store)

        for (const callbacks of [this._afterCallbacks, this._errorCallbacks]) {
            for (const key of Object.keys(callbacks)) {
                if (key.startsWith(keyPrefix)) {
                    delete callbacks[key]
                }
            }
        }
    }

    getMutationSubscriptions(store: Store): Set<StoreMutationSubscriptionCallback> | undefined {
        return this._mutationSubscriptions.get(store)
    }

    getOnActionAfterCallbacks(storageKey: string): StoreOnActionAfterCallbackParameter[] | undefined {
        return this._afterCallbacks[storageKey]
    }

    getOnActionOnErrorCallbacks(storageKey: string): Array<(error: unknown) => void> | undefined {
        return this._errorCallbacks[storageKey]
    }

    getOnActionSubscriptions(store: Store): Set<StoreOnActionSubscriptionCallback> | undefined {
        return this._onActionSubscriptions.get(store)
    }

    hasMutationUnsubscribe(store: Store): boolean {
        return this._mutationUnsubscribes.has(store)
    }

    isDisposed(store: Store): boolean {
        return this._disposedStores.has(store)
    }

    isOnActionHooked(store: Store): boolean {
        return this._onActionStores.has(store)
    }

    markOnActionHooked(store: Store): void {
        this._onActionStores.add(store)
    }

    /** Registers the names of the subscribers that subscribed to the store hooks, for tracing. */
    setTraces(store: Store, traces: { onAction: string[], onMutation: string[] }): void {
        this._onActionTraces.set(store, traces.onAction)
        this._mutationTraces.set(store, traces.onMutation)
    }

    setMutationUnsubscribe(store: Store, unsubscribe: () => void): void {
        this._mutationUnsubscribes.set(store, unsubscribe)
    }

    /** Wraps `store.$dispose` (once per store) to release the registry entries of the store. */
    registerStoreCleanup(store: Store, { onDispose, onError }: StoreCleanupHandlers): void {
        if (typeof store.$dispose !== 'function') {
            return
        }

        const dispose = store.$dispose.bind(store)
        const scopedStore = store as AnyObject

        if (scopedStore.__piniaPluginSubscriptionDisposed) {
            return
        }

        scopedStore.__piniaPluginSubscriptionDisposed = true
        store.$dispose = () => {
            try {
                this._disposedStores.add(store)
                this.clearStore(store)
                onDispose(store)
            } catch (error) {
                onError(error, store)
            }
            return dispose()
        }
    }
}
