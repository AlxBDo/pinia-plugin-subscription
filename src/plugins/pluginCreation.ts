import { eppsLogError } from "../utils/log"

import type { PiniaPluginContext, StateTree, Store } from "pinia"
import type { PluginSubscriber } from "../types/plugin"
import { AnyObject } from "../types"
import { hasDeniedFirstChar } from "../utils/store"


class PluginSubscription {
    private _debug: boolean = false
    private _resetStoreCallback: Function[] = []
    private _subscribers: PluginSubscriber[] = []

    set debug(debug: boolean) { this._debug = debug }

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }


    addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    addSubscriber(subscriber: PluginSubscriber): void {
        this._subscribers.push(subscriber)
    }

    executeResetStoreCallbacks(store: Store): void {
        this._resetStoreCallback.forEach(callback => callback(store))
    }

    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        try {
            this._subscribers.forEach(
                subscriber => {
                    subscriber.invoke({ store, options } as PiniaPluginContext, this._debug)

                    if (subscriber.resetStoreCallback) {
                        this.addResetStoreCallback(subscriber.resetStoreCallback)
                    }
                }
            )

            this.rewriteResetStore({ store } as PiniaPluginContext, Object.assign({}, store.$state), Object.assign({}, store))
        } catch (e) {
            eppsLogError('plugin()', [e, store, options])
        }
    }

    private rewriteResetStore({ store }: PiniaPluginContext, initState: StateTree, customStore: AnyObject): void {
        store.$reset = () => {
            this.executeResetStoreCallbacks(store)

            Object.keys(customStore).forEach((key: string) => {
                if (!hasDeniedFirstChar(key)) {
                    store[key] = initState[key] ?? customStore[key]
                }
            })

            store.$patch(JSON.parse(JSON.stringify(initState)))
        }
    }
}

export default new PluginSubscription()