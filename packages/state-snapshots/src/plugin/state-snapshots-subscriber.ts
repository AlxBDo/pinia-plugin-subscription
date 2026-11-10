import { PluginSubscriberWithoutInstance, StoreEventsSubscriber, traceGroups } from 'pinia-plugin-subscription/helpers'
import { deepClone } from '../utils/deep-clone'
import { PLUGIN_NAME } from '../utils/constants'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'

import type { PiniaPluginContext, StateTree } from 'pinia'
import type { PluginOptions } from 'pinia-plugin-subscription/types'


export class StateSnapshotsSubscriberClass extends PluginSubscriberWithoutInstance {
    private _eventsStoreSubscribers: WeakMap<PiniaPluginContext['store'], StoreEventsSubscriber> = new WeakMap()
    private _rollbackStateSnapshotsHandler = new RollbackStateSnapshotsHandler()
    public overrideReset: boolean = false


    constructor() {
        super(PLUGIN_NAME)
        this.execution = { order: 0 }
    }


    private addOnResetStoreSubscriptionCollector(store: PiniaPluginContext['store']) {
        store._resetStoreCallbacks = store?._resetStoreCallbacks || []
        store.$onResetStore = (callback: (store?: PiniaPluginContext['store']) => void) => {
            store._resetStoreCallbacks.push(callback)
        }
    }

    public override invoke({ options, store }: PiniaPluginContext, pluginOptions?: PluginOptions) {
        super.invoke?.({ options, store } as PiniaPluginContext, pluginOptions)
        if (!pluginOptions) {
            throw new Error('State snapshots require plugin options with an events handler')
        }
        this.addOnResetStoreSubscriptionCollector(store)
        const eventsStoreSubscriber = this._rollbackStateSnapshotsHandler.initFromPluginContext({ options, store } as PiniaPluginContext)

        const rewriteResetStore = this.overrideReset || options?.storeOptions?.overrideReset

        if (!eventsStoreSubscriber && !rewriteResetStore) {
            return false
        }

        if (eventsStoreSubscriber) {
            this._eventsStoreSubscribers.set(store, eventsStoreSubscriber)
            pluginOptions.eventsHandler.subscribe(store.$id, eventsStoreSubscriber)
            this.trace('eventsStoreSubscriber:subscribed', store.$id, () => ({ eventsStoreSubscriber }))
        }

        if (rewriteResetStore) {
            this.rewriteResetStore({ options, store } as PiniaPluginContext, store.$state)
        }

        return true
    }

    private rewriteResetStore(
        { store }: PiniaPluginContext,
        initState: StateTree
    ): void {
        let callId = 0
        let callErrorId = 1000
        let safeState: StateTree
        try {
            safeState = deepClone(initState)
        } catch (error) {
            this.traceError('reset:rewrite:error', error, store.$id)
            console.error(
                `Failed to capture initial reset state for store '${store.$id}'; the store's existing reset method was preserved.`,
                error
            )
            return
        }

        store.$reset = () => {
            const state = deepClone(safeState)
            store.$patch(state)
            this.trace('$reset:store:patched', store.$id, () => ({
                state,
                groupId: traceGroups.reset(store.$id, ++callId)
            }))
            if (Array.isArray(store._resetStoreCallbacks) && store._resetStoreCallbacks.length > 0) {
                this.trace('$reset:execute:callbacks', store.$id, () => ({
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
                            this.traceError('reset:rewrite:callback:error', error, store.$id, () => ({
                                groupId: traceGroups.reset(store.$id, ++callErrorId)
                            }))
                            console.error(`Error occurred while executing reset callbacks for store '${store.$id}':`, error)
                        }
                    }
                )
            }
        }
    }
}

export const StateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()