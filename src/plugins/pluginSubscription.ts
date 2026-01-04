import Debug from "../system/Debug"
import { PluginConsole } from "../system/log"
import { hasDeniedFirstChar } from "../utils/store"
import { isEmpty } from "../utils/validation"

import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { AnyObject } from "../types"
import type { PluginSubscriber, PluginSubscriptions, StoreMutationSubscription, StoreOnActionSubscription } from "../types/plugin"


export default class PluginSubscription extends Debug {
    protected _className: string = 'PluginSubscription'
    private _resetStoreCallback: Function[] = []
    private _subscribers: PluginSubscriber[] = []
    private _subscriptions: PluginSubscriptions[] = []

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }

    get subscriptions(): PluginSubscriptions[] | undefined {
        if (!isEmpty(this._subscriptions)) {
            return this._subscriptions
        }
    }

    constructor(subscribers: PluginSubscriber[], debug?: boolean) {
        super(debug ?? false, PluginConsole)
        this._subscribers = subscribers
    }


    private addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    private executeResetStoreCallbacks(store: Store): void {
        this._resetStoreCallback.forEach(callback => callback(store))
    }

    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        this.debugLog(`plugin() - store: ${store.$id}`, [
            'subscriber:', this._subscribers,
            'store:', store,
            'options:', options
        ])

        try {
            this._subscribers.forEach(
                subscriber => {
                    subscriber.invoke({ store, options } as PiniaPluginContext, this.debug)

                    if (subscriber.subscriptions) {
                        this.subscriptionDelivery({ store, options } as PiniaPluginContext, subscriber.subscriptions)
                    }

                    if (subscriber.storeMutationSubscription) {
                        this.storeMutationSubscription(subscriber.storeMutationSubscription)
                    }

                    if (subscriber.storeOnActionSubscription) {
                        this.storeOnActionSubscription(subscriber.storeOnActionSubscription)
                    }

                    if (subscriber.resetStoreCallback) {
                        this.addResetStoreCallback(subscriber.resetStoreCallback)
                    }
                }
            )

            this.rewriteResetStore({ store } as PiniaPluginContext, Object.assign({}, store.$state), Object.assign({}, store))
        } catch (e) {
            this.logError(e, store, options)
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
            this.debugLog(`storeOnActionSubscription ${store.$id}`, [after, args, name, store])
            callback({ after, args, name })
        })
    }

    private storeMutationSubscription(subscription: StoreMutationSubscription): void {
        const { store, callback } = subscription()

        store.$subscribe((mutation: SubscriptionCallbackMutation<StateTree>) => {
            this.debugLog(`$subscribe ${store.$id}`, [mutation, store])
            callback(mutation)
        })
    }

    private subscriptionDelivery({ store, options }: PiniaPluginContext, pluginSubscriptions: PluginSubscriptions): void {
        Object.entries(pluginSubscriptions).forEach(([pluginName, pluginSubscription]) => {
            try {
                const { subscription, subscriptionOptions, stores } = pluginSubscription

                this.debugLog(`subscriptionDelivery() - store: ${store.$id}`, [
                    'pluginName:', pluginName,
                    'subscription:', subscription,
                    'options:', subscriptionOptions
                ])

                subscription.invoke(
                    { store, options: { ...options, ...subscriptionOptions } } as PiniaPluginContext,
                    this.debug
                )

                if (!isEmpty(stores)) {
                    stores?.forEach(
                        store => subscription.invoke(
                            {
                                store,
                                options: {
                                    ...options,
                                    ...subscriptionOptions,
                                    ...((store as AnyObject)?.storeOptions ?? {})
                                }
                            } as PiniaPluginContext,
                            this.debug
                        )
                    )
                }
            } catch (e) {
                this.logError(`subscriptionDelivery() - ${pluginName}`, e, store, options)
            }
        })
    }
}