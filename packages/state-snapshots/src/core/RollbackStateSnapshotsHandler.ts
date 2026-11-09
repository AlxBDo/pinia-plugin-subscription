import {
    getActionStoreKey,
    hasDeniedFirstChar,
    STORE_EVENTS,
    StoreEventsSubscriber
} from 'pinia-plugin-subscription/helpers'
import { createStateSnapshot, restoreStateSnapshot } from "../factories/state-snapshot"
import { createStoreEventsSubscriber } from '../factories/store-events-subscriber'


import type { PiniaPluginContext, StateTree, Store } from 'pinia'
import type { } from 'pinia-plugin-subscription'
import type { AnyObject } from 'pinia-plugin-subscription/types'
import type { CreateStateSnapshotKeys, StateSnapshot } from '../types/plugin'
import type { RollbackActionParams } from '../types/store'


/**
 * Handles rollback state snapshots for Pinia stores.
 * This class provides methods to add rollback actions to stores,
 * create rollback snapshots, and manage the state snapshots internally.
 */
export default class RollbackStateSnapshotsHandler {
    private _stateSnapshots: Map<symbol, { store: Store, snapshot: StateSnapshot }> = new Map()
    private _storeHasRollbackSnapshots: WeakSet<Store> = new WeakSet()
    private _storeRollbackSnapshotsParams: WeakMap<Store, Map<string, unknown>> = new WeakMap()


    /**
     * Adds a rollback action to the given store.
     * This method extends the store with a $rollbackAfterFailure function that handles rollback logic for actions.
     * The action arguments are forwarded through apply(), so they must be provided as a single array.
     * @param {Store} store The store to which the rollback action will be added.
     * @returns void
     */
    addRollbackAction(store: Store): void {
        if (typeof store?.$rollbackAfterFailure === 'function') {
            return
        }

        store.$rollbackAfterFailure = async ({ action, stateKeys }: RollbackActionParams, args: any[] = []) => {
            const actionFn = (store as AnyObject)[action]
            if (typeof actionFn !== 'function' || hasDeniedFirstChar(action)) {
                throw new TypeError(`Invalid rollback action: ${action}`)
            }

            const keys: CreateStateSnapshotKeys = stateKeys === undefined || (Array.isArray(stateKeys) && stateKeys.length === 0)
                ? 'all'
                : stateKeys

            const snapshotKey = this.tryCreateStateSnapshot(store, action, () => this.saveStateSnapshot(store, action, keys))
            try {
                await actionFn.apply(store, args)
            } catch (error) {
                if (snapshotKey) {
                    try {
                        this.patchStore(snapshotKey, store)
                    } catch (restoreError) {
                        throw new AggregateError([error, restoreError], `Failed to restore snapshot for action '${action}'`)
                    }
                }
                throw error
            } finally {
                this.removeStateSnapshot(snapshotKey)
            }
        }
    }

    private createStateSnapshot(store: Store, actionName: string, snapshotKey: symbol) {
        const params = this._storeRollbackSnapshotsParams.get(store)
        if (!params?.has(actionName)) {
            return
        }
        const stateKeys = params.get(actionName)
        if (stateKeys !== 'all' && !Array.isArray(stateKeys)) {
            throw new TypeError(`Invalid snapshot keys for action '${actionName}'`)
        }

        const keys: CreateStateSnapshotKeys = (stateKeys.length === 0 || stateKeys[0] === 'all') ? 'all' : stateKeys
        return this.saveStateSnapshot(store, actionName, keys, snapshotKey)
    }

    private tryCreateStateSnapshot(store: Store, actionName: string, capture: () => symbol | undefined): symbol | undefined {
        try {
            return capture()
        } catch (error) {
            console.error(
                `Failed to create rollback snapshot for action '${actionName}' in store '${store.$id}'; the action will run without this rollback snapshot.`,
                error
            )
        }
    }

    private createStoreEventsSubscriber(store: Store) {
        const patchStoreAndRemoveSnapshot = (actionName: string, error: unknown, snapshotKey: symbol) => {
            try {
                this.patchStore(snapshotKey, store)
            } catch (restoreError) {
                throw new AggregateError([error, restoreError], `Failed to restore snapshot for action '${actionName}'`)
            } finally {
                this.removeStateSnapshot(snapshotKey)
            }
        }

        return createStoreEventsSubscriber(store, {
            [STORE_EVENTS.ACTION_BEFORE]: (actionName: string, snapshotKey: symbol) => {
                this.tryCreateStateSnapshot(store, actionName, () => this.createStateSnapshot(store, actionName, snapshotKey))
            },
            [STORE_EVENTS.ACTION_AFTER]: (_actionName: string, snapshotKey: symbol) => this.removeStateSnapshot(snapshotKey),
            [STORE_EVENTS.ACTION_ERROR]: (_actionName: string, _error: unknown, snapshotKey: symbol) => this.removeStateSnapshot(snapshotKey),
            [STORE_EVENTS.ACTION_ON_ERROR]: patchStoreAndRemoveSnapshot
        }, () => this.clearStoreTracking(store))
    }

    /**
     * Initializes the rollback state snapshots handler from the given Pinia plugin context.
     * This method extracts the rollback snapshot parameters from the store options and stores them internally.
     * @param {PiniaPluginContext} param0 The Pinia plugin context containing the store and its options.
     * @returns {StoreEventsSubscriber | undefined} The event subscriber for the store, or `undefined` if it is already initialized.
     */
    initFromPluginContext({ options, store }: PiniaPluginContext) {
        let eventSubscriber: StoreEventsSubscriber | undefined
        const rollbackSnapshotParams = options?.storeOptions?.rollbackAfterFailure as Record<string, CreateStateSnapshotKeys>
        if (rollbackSnapshotParams && !this._storeHasRollbackSnapshots.has(store)) {
            const params = new Map<string, unknown>()
            Object.keys(rollbackSnapshotParams).forEach(key => {
                params.set(key, rollbackSnapshotParams[key])
            })
            this._storeRollbackSnapshotsParams.set(store, params)
            this._storeHasRollbackSnapshots.add(store)
            eventSubscriber = this.createStoreEventsSubscriber(store)
        } else if (!rollbackSnapshotParams) {
            eventSubscriber = createStoreEventsSubscriber(store, undefined, () => this.clearStoreTracking(store))
        }
        this.addRollbackAction(store)
        return eventSubscriber
    }

    /**
     * Clears all rollback tracking data for the given store.
     * Must be called when the store is disposed to avoid memory leaks with dynamically created stores.
     * @param {Store} store The disposed Pinia store instance.
     * @returns void
     */
    clearStoreTracking(store: Store): void {
        this._storeRollbackSnapshotsParams.delete(store)
        this._storeHasRollbackSnapshots.delete(store)
        for (const [snapshotKey, entry] of this._stateSnapshots) {
            if (entry.store === store) {
                this._stateSnapshots.delete(snapshotKey)
            }
        }
    }

    private patchStore(snapshotKey: symbol, store: Store): void {
        const entry = this._stateSnapshots.get(snapshotKey)
        if (!entry || entry.store !== store) {
            return
        }

        store.$patch((state: StateTree) => restoreStateSnapshot(state, entry.snapshot))
    }

    /**
     * Removes a state snapshot identified by the given snapshot key from the internal state snapshot tracking.
     * @param snapshotKey The key of the state snapshot to be removed.
     * @returns void
     */
    private removeStateSnapshot(snapshotKey?: symbol): void {
        if (!snapshotKey) {
            return
        }

        this._stateSnapshots.delete(snapshotKey)
    }

    /**
     * Saves the current state snapshot for a given store and action.
     * @param store The Pinia store instance.
     * @param actionName The name of the action being executed.
     * @param stateKeys The state keys to include in the snapshot, or 'all' for the full state.
     * @param snapshotKey Optional invocation key for correlating action lifecycle events.
     * @returns A unique symbol key representing the saved snapshot.
     */
    private saveStateSnapshot(
        store: Store,
        actionName: string,
        stateKeys: CreateStateSnapshotKeys,
        snapshotKey = Symbol(getActionStoreKey(actionName, store))
    ): symbol {
        const stateSnapshot = createStateSnapshot(
            store.$state,
            stateKeys
        )

        this._stateSnapshots.set(snapshotKey, { store, snapshot: stateSnapshot })
        return snapshotKey
    }

    /**
     * Checks if the given store has rollback snapshots.
     * @param store The Pinia store instance.
     * @returns True if the store has rollback snapshots, false otherwise.
     */
    storeHasRollbackSnapshots(store: Store): boolean {
        return this._storeHasRollbackSnapshots.has(store)
    }
}