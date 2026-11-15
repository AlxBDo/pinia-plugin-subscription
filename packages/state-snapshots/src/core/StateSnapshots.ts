import {
    getActionStoreKey,
    hasDeniedFirstChar,
    Store,
    STORE_EVENTS,
    traceGroups
} from 'pinia-plugin-subscription/helpers'
import { createStateSnapshot, restoreStateSnapshot } from "../factories/state-snapshot"
import { createStoreEventsSubscriber } from '../factories/store-events-subscriber'
import { deepClone } from '../utils/deep-clone'

import type { StateTree, Store as PiniaStore, PiniaPluginContext } from 'pinia'
import type { } from 'pinia-plugin-subscription'
import type { AnyObject, StoreClassConstructorParams } from 'pinia-plugin-subscription/types'
import type { CreateStateSnapshotKeys, StateSnapshot } from '../types/plugin'
import type { RollbackActionParams } from '../types/store'


/**
 * Handles rollback state snapshots for Pinia stores.
 * This class provides methods to add rollback actions to stores,
 * create rollback snapshots, and manage the state snapshots internally.
 */
export default class StateSnapshots extends Store {
    private _isInitialized: boolean = false
    protected override _name = 'RollbackStateSnapshots'
    protected static _requiredKeys: string[] = ['overrideReset', 'rollbackAfterFailure']
    protected static _requiredKeysValidation: 'some' = 'some'
    private _rollbackSnapshotsParams: Map<string, unknown> = new Map()
    private _stateSnapshots: Map<symbol, { store: PiniaStore, snapshot: StateSnapshot }> = new Map()


    private addOnResetStoreSubscriptionCollector(store: PiniaPluginContext['store']) {
        store._resetStoreCallbacks = store?._resetStoreCallbacks || []
        store.$onResetStore = (callback: (store?: PiniaPluginContext['store']) => void) => {
            store._resetStoreCallbacks.push(callback)
        }
    }


    /**
     * Adds a rollback action to the given store.
     * This method extends the store with a $rollbackAfterFailure function that handles rollback logic for actions.
     * The action arguments are forwarded through apply(), so they must be provided as a single array.
     * @param store The store to which the rollback action will be added.
     * @returns void
     */
    addRollbackAction(store: PiniaStore): void {
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

    private createStateSnapshot(store: PiniaStore, actionName: string, snapshotKey: symbol) {
        if (!this._rollbackSnapshotsParams.has(actionName)) {
            return
        }
        const stateKeys = this._rollbackSnapshotsParams.get(actionName)
        if (stateKeys !== 'all' && !Array.isArray(stateKeys)) {
            throw new TypeError(`Invalid snapshot keys for action '${actionName}'`)
        }

        const keys: CreateStateSnapshotKeys = (stateKeys.length === 0 || stateKeys[0] === 'all') ? 'all' : stateKeys
        return this.saveStateSnapshot(store, actionName, keys, snapshotKey)
    }

    private addRollbackStoreEventsSubscriber(store: PiniaStore) {
        const patchStoreAndRemoveSnapshot = (actionName: string, error: unknown, snapshotKey: symbol) => {
            try {
                this.patchStore(snapshotKey, store)
                this.trace(`${actionName}:store:patched`, store.$id, () => ({ groupId: traceGroups.onActionError }))
            } catch (restoreError) {
                throw new AggregateError([error, restoreError], `Failed to restore snapshot for action '${actionName}'`)
            } finally {
                this.removeStateSnapshot(snapshotKey)
            }
        }

        this.addEventStoreSubscriber(
            createStoreEventsSubscriber(store, {
                [STORE_EVENTS.ACTION_BEFORE]: (actionName: string, snapshotKey: symbol) => {
                    this.tryCreateStateSnapshot(store, actionName, () => this.createStateSnapshot(store, actionName, snapshotKey))
                },
                [STORE_EVENTS.ACTION_AFTER]: (_actionName: string, snapshotKey: symbol) => this.removeStateSnapshot(snapshotKey),
                [STORE_EVENTS.ACTION_ERROR]: (_actionName: string, _error: unknown, snapshotKey: symbol) => this.removeStateSnapshot(snapshotKey),
                [STORE_EVENTS.ACTION_ON_ERROR]: patchStoreAndRemoveSnapshot,
            })
        )
    }

    protected override init() {
        if (this._isInitialized) return
        super.init()

        const store = this.store as PiniaStore
        if (this.options?.rollbackAfterFailure) {
            if (typeof this.options.rollbackAfterFailure === 'object') {
                Object.keys(this.options?.rollbackAfterFailure).forEach(key => {
                    this._rollbackSnapshotsParams.set(key, (this.options.rollbackAfterFailure as Record<string, CreateStateSnapshotKeys>)[key])
                })
            }
            this.addRollbackStoreEventsSubscriber(store)
        }
        this.addRollbackAction(store)

        if (this.options.overrideReset) {
            this.addOnResetStoreSubscriptionCollector(store)
            this.rewriteResetStore(store, store.$state)
        }
        this._isInitialized = true
    }

    protected override onDispose(): void {
        this._isInitialized = false
        this._rollbackSnapshotsParams.clear()
        this._stateSnapshots.clear()
    }

    private patchStore(snapshotKey: symbol, store: PiniaStore): void {
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

    private rewriteResetStore(
        store: PiniaPluginContext['store'],
        initState: StateTree
    ): void {
        let callId = 0
        let callErrorId = 1000
        let safeState: StateTree
        try {
            safeState = deepClone(initState)
        } catch (error) {
            this.traceError('store:reset:rewrite:error', error, store.$id)
            console.error(
                `Failed to capture initial reset state for store '${store.$id}'; the store's existing reset method was preserved.`,
                error
            )
            return
        }

        store.$reset = () => {
            const state = deepClone(safeState)
            store.$patch(state)
            this.trace('store:$reset:store:patched', store.$id, () => ({
                state,
                groupId: traceGroups.reset(store.$id, ++callId)
            }))
            if (Array.isArray(store._resetStoreCallbacks) && store._resetStoreCallbacks.length > 0) {
                this.trace('store:$reset:execute:callbacks', store.$id, () => ({
                    callbacks: store._resetStoreCallbacks.length,
                    groupId: traceGroups.reset(store.$id, ++callId)
                }))
                store._resetStoreCallbacks.forEach(
                    callback => {
                        try {
                            if (typeof callback === 'function') {
                                callback(store)
                            }
                        } catch (error) {
                            this.traceError('store:reset:rewrite:callback:error', error, store.$id, () => ({
                                groupId: traceGroups.reset(store.$id, ++callErrorId)
                            }))
                            console.error(`Error occurred while executing reset callbacks for store '${store.$id}':`, error)
                        }
                    }
                )
            }
        }
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
        store: PiniaStore,
        actionName: string,
        stateKeys: CreateStateSnapshotKeys,
        snapshotKey = Symbol(getActionStoreKey(actionName, store))
    ): symbol {
        this._stateSnapshots.set(snapshotKey, {
            store,
            snapshot: createStateSnapshot(
                store.$state,
                stateKeys
            )
        })
        return snapshotKey
    }

    private tryCreateStateSnapshot(
        store: PiniaStore, actionName: string, capture: () => symbol | undefined
    ): symbol | undefined {
        try {
            return capture()
        } catch (error) {
            console.error(
                `Failed to create rollback snapshot for action '${actionName}' in store '${store.$id}'; the action will run without this rollback snapshot.`,
                error
            )
        }
    }
}