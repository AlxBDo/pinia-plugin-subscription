import { createStateSnapshot } from "../factories/state-snapshot"
import { getActionStoreKey, hasDeniedFirstChar } from '../utils/store'

import type { PiniaPluginContext, StateTree, Store } from 'pinia'
import type { AnyObject } from '../types'
import type { CreateStateSnapshotKeys } from '../types/plugin'
import type { RollbackActionParams } from '../types/store'


/**
 * Handles rollback state snapshots for Pinia stores.
 * This class provides methods to add rollback actions to stores,
 * create rollback snapshots, and manage the state snapshots internally.
 */
export default class RollbackStateSnapshotsHandler {
    private _stateSnapshots: Map<symbol, StateTree> = new Map()
    private _storeHasRollbackSnapshots: Set<string> = new Set()
    private _storeRollbackSnapshotsParams: Map<string, CreateStateSnapshotKeys> = new Map()


    /**
     * Adds a rollback action to the given store.
     * This method extends the store with a $rollbackAfterFailure function that handles rollback logic for actions.
     * @param {Store} store The store to which the rollback action will be added.
     * @returns void
     */
    addRollbackAction(store: Store): void {
        if (typeof store.$rollbackAfterFailure === 'function') {
            return
        }

        store.$rollbackAfterFailure = async ({ action, stateKeys }: RollbackActionParams, ...args: any[]) => {
            const actionFn = (store as AnyObject)[action]
            if (typeof actionFn !== 'function' || hasDeniedFirstChar(action)) {
                return
            }

            const keys: CreateStateSnapshotKeys = !stateKeys || stateKeys.length === 0 ? 'all' : stateKeys

            const snapshotKey = this.saveStateSnapshot(store, action, keys)
            try {
                await actionFn.apply(store, args)
            } catch (error) {
                this.patchStore(snapshotKey, store)
                throw error
            } finally {
                this.removeStateSnapshot(snapshotKey)
            }
        }
    }

    /**
     * Creates a rollback snapshot for the specified action and store.
     * This snapshot can be used to restore the store's state in case of an error during the action execution.
     * @param {string} actionName The name of the action for which the rollback snapshot is created.
     * @param {Store} store The Pinia store instance.
     * @returns An object containing `after` and `onError` callbacks for handling the rollback, or `undefined` if no snapshot is created.
     */
    createOnActionCallbacks(
        actionName: string,
        store: Store
    ): {
        after: () => void,
        onError: () => void
    } | undefined {
        const stateKeys = this._storeRollbackSnapshotsParams.get(
            getActionStoreKey(actionName, store)
        )

        if (!stateKeys || stateKeys.length === 0) {
            return
        }

        const snapshotKey = this.saveStateSnapshot(store, actionName, stateKeys)

        return {
            after: () => { this.removeStateSnapshot(snapshotKey) },
            onError: () => {
                this.patchStore(snapshotKey, store)
                this.removeStateSnapshot(snapshotKey)
            }
        }
    }

    /**
     * Initializes the rollback state snapshots handler from the given Pinia plugin context.
     * This method extracts the rollback snapshot parameters from the store options and stores them internally.
     * @param {PiniaPluginContext} param0 The Pinia plugin context containing the store and its options.
     * @returns void
     */
    initFromPluginContext({ options, store }: PiniaPluginContext) {
        const rollbackSnapshotParams = options?.storeOptions?.rollbackAfterFailure as Record<string, CreateStateSnapshotKeys>
        if (rollbackSnapshotParams && !this._storeHasRollbackSnapshots.has(store.$id)) {
            Object.keys(rollbackSnapshotParams).forEach(key => {
                this._storeRollbackSnapshotsParams.set(
                    getActionStoreKey(key, store),
                    rollbackSnapshotParams[key]
                )
            })
            this._storeHasRollbackSnapshots.add(store.$id)
        }
        this.addRollbackAction(store)
    }

    /**
     * Clears all rollback tracking data for the given store.
     * Must be called when the store is disposed to avoid memory leaks with dynamically created stores.
     * @param {Store} store The disposed Pinia store instance.
     * @returns void
     */
    clearStoreTracking(store: Store): void {
        const suffix = `-${store.$id}`

        for (const key of Array.from(this._storeRollbackSnapshotsParams.keys())) {
            if (key.endsWith(suffix)) {
                this._storeRollbackSnapshotsParams.delete(key)
            }
        }

        this._storeHasRollbackSnapshots.delete(store.$id)

        for (const snapshotKey of Array.from(this._stateSnapshots.keys())) {
            if (snapshotKey.description?.startsWith(`${store.$id}:`)) {
                this._stateSnapshots.delete(snapshotKey)
            }
        }
    }

    private patchStore(snapshotKey: symbol, store: Store): void {
        const stateSnapshot = this._stateSnapshots.get(snapshotKey)
        if (!stateSnapshot) {
            return
        }

        try {
            store.$patch(stateSnapshot)
        } catch (error) {
            console.error(`Failed to patch store with snapshot ${String(snapshotKey)}`, error)
        }
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
     * @returns A unique symbol key representing the saved snapshot.
     */
    private saveStateSnapshot(store: Store, actionName: string, stateKeys: CreateStateSnapshotKeys): symbol {
        const stateSnapshot = createStateSnapshot(
            store.$state,
            stateKeys
        )

        const snapshotKey = Symbol(`${store.$id}:${actionName}`)
        this._stateSnapshots.set(snapshotKey, stateSnapshot)
        return snapshotKey
    }

    /**
     * Checks if the given store has rollback snapshots.
     * @param store The Pinia store instance.
     * @returns True if the store has rollback snapshots, false otherwise.
     */
    storeHasRollbackSnapshots(store: Store): boolean {
        return this._storeHasRollbackSnapshots.has(store.$id)
    }
}