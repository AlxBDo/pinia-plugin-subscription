import { AnyObject } from "../types"
import { eppsLog, eppsLogError } from "../utils/log"
import { hasDeniedFirstChar } from "../utils/store"
import { isEmpty } from "../utils/validation"

import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { PluginSubscriber, PluginSubscriptions, StoreMutationSubscription, StoreOnActionSubscription } from "../types/plugin"


class PluginSubscription {
    private _debug: boolean = false
    private _resetStoreCallback: Function[] = []
    private _subscribers: PluginSubscriber[] = []
    private _subscriptions: PluginSubscriptions[] = []

    set debug(debug: boolean) { this._debug = debug }

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }

    get subscriptions(): PluginSubscriptions[] | undefined {
        if (!isEmpty(this._subscriptions)) {
            return this._subscriptions
        }
    }


    addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    addSubscriber(subscriber: PluginSubscriber): void {
        this._subscribers.push(subscriber)
    }

    addSubscriptions(subscriptions?: PluginSubscriptions): void {
        if (subscriptions) {
            this._subscriptions = [...this._subscriptions, subscriptions]
        }
    }

    executeResetStoreCallbacks(store: Store): void {
        this._resetStoreCallback.forEach(callback => callback(store))
    }

    findPluginSubscriptions(pluginName: string): PluginSubscriptions[] | undefined {
        return this._subscriptions.filter(
            (subscriptions: PluginSubscriptions | undefined) => (subscriptions && subscriptions[pluginName])
        )
    }

    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        try {
            this._subscribers.forEach(
                subscriber => {
                    subscriber.invoke({ store, options } as PiniaPluginContext, this._debug)
                    this.addSubscriptions(subscriber.subscriptions)

                    if (subscriber.resetStoreCallback) {
                        this.addResetStoreCallback(subscriber.resetStoreCallback)
                    }
                }
            )

            this.subscriptionDelivery({ store, options } as PiniaPluginContext)
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

    private storeOnActionSubscription(subscription: StoreOnActionSubscription): void {
        const { store, callback } = subscription()

        store.$onAction(({ after, args, name }) => {
            this._debug && eppsLog(`store.$subscribe ${store.$id}`, [after, args, name, store])
            callback({ after, args, name })
        })
    }

    private storeMutationSubscription(subscription: StoreMutationSubscription): void {
        const { store, callback } = subscription()

        store.$subscribe((mutation: SubscriptionCallbackMutation<StateTree>) => {
            this._debug && eppsLog(`store.$subscribe ${store.$id}`, [mutation, store])
            callback(mutation)
        })
    }

    private subscriptionDelivery({ store, options }: PiniaPluginContext): void {
        this._subscribers.forEach(
            subscriber => {
                const pluginSubscriptions = this.findPluginSubscriptions(subscriber.name)
                if (!isEmpty(pluginSubscriptions)) {
                    pluginSubscriptions?.forEach(
                        (subscriptions: PluginSubscriptions) => {
                            const stores = subscriptions[subscriber.name]?.(store)
                            stores?.forEach(s => {
                                subscriber.invoke({ store: s, options } as PiniaPluginContext, this._debug)
                            })
                        }
                    )
                }

                if (subscriber.storeMutationSubscription) {
                    this.storeMutationSubscription(subscriber.storeMutationSubscription)
                }

                if (subscriber.storeOnActionSubscription) {
                    this.storeOnActionSubscription(subscriber.storeOnActionSubscription)
                }
            }
        )
    }
}

export default new PluginSubscription()