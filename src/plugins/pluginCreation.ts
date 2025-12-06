import { eppsLogError } from "../utils/log"

import type { PiniaPluginContext, StateTree } from "pinia"
import type { PluginSubscriber } from "../types/plugin"


class PluginSubscription {
    private _debug: boolean = false
    private _resetStoreCallback: Function | undefined = undefined
    private _subscribers: PluginSubscriber[] = []

    set debug(debug: boolean) { this._debug = debug }

    set resetStoreCallback(callback: Function) { this._resetStoreCallback = callback }

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }


    addSubscriber(subscriber: PluginSubscriber): void {
        this._subscribers.push(subscriber)
    }

    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        try {
            this._subscribers.forEach(
                subscriber => subscriber.invoke({ store, options } as PiniaPluginContext, this._debug)
            )
            this.rewriteResetStore({ store } as PiniaPluginContext, Object.assign({}, store.$state))
        } catch (e) {
            eppsLogError('plugin()', [e, store, options])
        }
    }

    private rewriteResetStore({ store }: PiniaPluginContext, initState: StateTree): void {
        store.$reset = () => {
            if (this._resetStoreCallback) { this._resetStoreCallback() }

            Object.keys(store).forEach((key: string) => {
                store[key] = initState[key] ?? undefined
            })

            //store.$patch(JSON.parse(JSON.stringify(initState)))
        }
    }
}

export default new PluginSubscription()