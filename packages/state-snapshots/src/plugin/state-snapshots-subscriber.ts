import { StoreEventsSubscriber } from 'pinia-plugin-subscription/helpers'
import { deepClone } from '../utils/deep-clone'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'

import type { PiniaPluginContext, StateTree } from 'pinia'
import type { PluginOptions, PluginSubscriberInterface } from 'pinia-plugin-subscription/types'


export class StateSnapshotsSubscriberClass implements PluginSubscriberInterface {
    private _eventsStoreSubscribers: WeakMap<PiniaPluginContext['store'], StoreEventsSubscriber> = new WeakMap()
    private _rollbackStateSnapshotsHandler = new RollbackStateSnapshotsHandler()
    execution = { order: 0 }
    name: string = 'pinia-plugin-state-snapshots'
    overrideReset: boolean = false


    private addOnResetStoreSubscriptionCollector(store: PiniaPluginContext['store']) {
        store._resetStoreCallbacks = store?._resetStoreCallbacks || []
        store.$onResetStore = (callback: (store?: PiniaPluginContext['store']) => void) => {
            store._resetStoreCallbacks.push(callback)
        }
    }

    invoke(context: PiniaPluginContext, pluginOptions?: PluginOptions) {
        if (!pluginOptions) {
            throw new Error('State snapshots require plugin options with an events handler')
        }

        const { options, store } = context
        this.addOnResetStoreSubscriptionCollector(store)
        const eventsStoreSubscriber = this._rollbackStateSnapshotsHandler.initFromPluginContext(context)

        const rewriteResetStore = this.overrideReset || options?.storeOptions?.overrideReset

        if (!eventsStoreSubscriber && !rewriteResetStore) {
            return false
        }

        if (eventsStoreSubscriber) {
            this._eventsStoreSubscribers.set(store, eventsStoreSubscriber)
            pluginOptions.eventsHandler.subscribe(store.$id, eventsStoreSubscriber)
        }

        if (rewriteResetStore) {
            this.rewriteResetStore(context, store.$state)
        }

        return true
    }

    private rewriteResetStore(
        { store }: PiniaPluginContext,
        initState: StateTree
    ): void {
        let safeState: StateTree
        try {
            safeState = deepClone(initState)
        } catch (error) {
            console.error(
                `Failed to capture initial reset state for store '${store.$id}'; the store's existing reset method was preserved.`,
                error
            )
            return
        }

        store.$reset = () => {
            store.$patch(deepClone(safeState))
            if (Array.isArray(store._resetStoreCallbacks)) {
                try {
                    store._resetStoreCallbacks.forEach(
                        callback => typeof callback === 'function' && callback(store)
                    )
                } catch (error) {
                    // TODO: Add Tracing mechanism for better error tracking
                    console.error(`Error occurred while executing reset callbacks for store '${store.$id}':`, error)
                }
            }
        }
    }
}

export const StateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()