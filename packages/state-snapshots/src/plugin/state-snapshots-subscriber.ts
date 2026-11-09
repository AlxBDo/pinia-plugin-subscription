import { StoreEventsSubscriber } from 'pinia-plugin-subscription/helpers'
import { deepClone } from '../utils/deep-clone'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'

import type { PiniaPluginContext, StateTree } from 'pinia'
import type { PluginOptions, PluginSubscriberInterface } from 'pinia-plugin-subscription/types'


export class StateSnapshotsSubscriberClass implements PluginSubscriberInterface {
    private _eventsStoreSubscribers: WeakMap<PiniaPluginContext['store'], StoreEventsSubscriber> = new WeakMap()
    private _rollbackStateSnapshotsHandler = new RollbackStateSnapshotsHandler()
    name: string = 'pinia-plugin-state-snapshots'
    overrideReset: boolean = false


    invoke(context: PiniaPluginContext, pluginOptions?: PluginOptions) {
        if (!pluginOptions) {
            throw new Error('State snapshots require plugin options with an events handler')
        }

        const { options, store } = context
        const eventsStoreSubscriber = this._rollbackStateSnapshotsHandler.initFromPluginContext(context)
        const onStoreReset = options?.storeOptions?.onResetStore ?? store?.onResetStore
        const rewriteResetStore = this.overrideReset || options?.storeOptions?.overrideReset

        if (!eventsStoreSubscriber && !rewriteResetStore && !onStoreReset) {
            return false
        }

        if (eventsStoreSubscriber) {
            this._eventsStoreSubscribers.set(store, eventsStoreSubscriber)
            pluginOptions.eventsHandler.subscribe(store.$id, eventsStoreSubscriber)
        }

        if (rewriteResetStore || onStoreReset) {
            this.rewriteResetStore(context, store.$state, onStoreReset)
        }

        return true
    }

    private rewriteResetStore(
        { store }: PiniaPluginContext,
        initState: StateTree,
        onStoreReset?: (store?: PiniaPluginContext['store']) => void
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
            if (onStoreReset) {
                onStoreReset(store)
            }
        }
    }
}

export const StateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()