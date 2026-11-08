import { StoreEventsSubscriber } from 'pinia-plugin-subscription/helpers'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'

import type { PiniaPluginContext } from 'pinia'
import type {} from 'pinia-plugin-subscription'
import type { PluginOptions, PluginSubscriberInterface } from 'pinia-plugin-subscription/types'


export class StateSnapshotsSubscriberClass implements PluginSubscriberInterface {
    private _eventsStoreSubscribers: WeakMap<PiniaPluginContext['store'], StoreEventsSubscriber> = new WeakMap()
    private _rollbackStateSnapshotsHandler = new RollbackStateSnapshotsHandler()
    name: string = 'pinia-plugin-state-snapshots'


    invoke(context: PiniaPluginContext, pluginOptions?: PluginOptions) {
        const { options, store } = context
        const hasRollbackAfterFailure = options?.storeOptions?.rollbackAfterFailure
        const hasReset = options?.storeOptions?.resetStore

        if (!hasRollbackAfterFailure && !hasReset) {
            return false
        }

        let eventsStoreSubscriber: StoreEventsSubscriber | undefined

        if (hasRollbackAfterFailure) {
            eventsStoreSubscriber = this._rollbackStateSnapshotsHandler.initFromPluginContext(context)
            if (eventsStoreSubscriber) {
                this._eventsStoreSubscribers.set(store, eventsStoreSubscriber)
            }
        }

        const subscriber = this._eventsStoreSubscribers.get(store)
        if (subscriber) {
            if (!pluginOptions) {
                throw new Error('State snapshots require plugin options with an events handler')
            }
            pluginOptions.eventsHandler.subscribe(store.$id, subscriber)
        }
        return true
    }
}

export const StateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()