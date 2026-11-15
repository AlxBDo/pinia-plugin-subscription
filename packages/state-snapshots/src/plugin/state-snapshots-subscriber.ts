import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import { PLUGIN_NAME } from '../utils/constants'
import StateSnapshots from '../core/StateSnapshots'

import type { PiniaPluginContext } from 'pinia'
import type { PluginOptions } from 'pinia-plugin-subscription/types'
import type { StateRestoredStoreOptions, RollbackActionParams, ResetStoreCallback } from '../types/store'



export class StateSnapshotsSubscriberClass extends PluginSubscriber<StateSnapshots> {
    protected _name: string = PLUGIN_NAME
    public overrideReset: boolean = false
    public rollbackAfterFailure: boolean = false


    constructor() {
        super(
            StateSnapshots.customizeStore.bind(StateSnapshots)
        )
        this.execution = { order: 0 }
    }

    public override invoke(context: PiniaPluginContext, pluginOptions?: PluginOptions) {
        const storeOptions = context.options.storeOptions
        return super.invoke({
            ...context,
            options: {
                ...context.options,
                storeOptions: {
                    ...storeOptions,
                    ...(this.overrideReset ? { overrideReset: true } : {}),
                    ...(this.rollbackAfterFailure && !storeOptions?.rollbackAfterFailure
                        ? { rollbackAfterFailure: true as const }
                        : {})
                }
            }
        }, pluginOptions)
    }
}

export const StateSnapshotsSubscriber = new StateSnapshotsSubscriberClass()


declare module 'pinia-plugin-subscription/types' {
    interface StoreOptionsExtensions extends StateRestoredStoreOptions { }
}

declare module 'pinia' {
    interface PiniaCustomProperties {
        $rollbackAfterFailure?: (params: RollbackActionParams, args?: any[]) => Promise<void>
        $onResetStore?: (callback: ResetStoreCallback) => void
    }
}