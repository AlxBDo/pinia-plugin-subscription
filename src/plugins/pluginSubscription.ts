import Debug from "../system/Debug"
import { PluginConsole } from "../system/log"
import { isEmpty } from "../utils/validation"

import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { AnyObject } from "../types"
import type {
    PluginSubscriber,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreOnActionSubscription
} from "../types/plugin"

const className = 'PluginSubscription'


export default class PluginSubscription extends Debug {
    private _pluginDebug?: string[]
    private _resetStoreCallback: Function[] = []
    private _subscribers: PluginSubscriber[] = []
    private _subscribersDelivered: Set<string> = new Set()
    private _subscriptions: PluginSubscriptions[] = []
    private _subscriptionsDelivered: Set<string> = new Set()

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }

    get subscriptions(): PluginSubscriptions[] | undefined {
        if (!isEmpty(this._subscriptions)) {
            return this._subscriptions
        }
    }

    constructor(subscribers: PluginSubscriber[], debug?: string[]) {
        super(Array.isArray(debug) && !!debug?.includes(className), PluginConsole)
        this._pluginDebug = Array.isArray(debug) ? debug : undefined
        this._subscribers = subscribers
    }


    private addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    private definePluginDebug(subscriber: PluginSubscriber): boolean {
        return !!this._pluginDebug?.includes(subscriber.name)
    }

    private executeResetStoreCallbacks(store: Store): void {
        this._resetStoreCallback.forEach(callback => callback(store))
    }

    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        this.debugLog(`plugin() - ${store.$id}`, [
            'subscriber:', this._subscribers,
            'store:', store,
            'options:', options
        ])

        try {
            this._subscribers.forEach(
                subscriber => {
                    if (this._subscribersDelivered.has(`${subscriber.name}-${store.$id}`)) {
                        return
                    }

                    if (
                        !subscriber.invoke(
                            { store, options } as PiniaPluginContext,
                            this.definePluginDebug(subscriber)
                        )) {
                        return
                    }

                    this._subscribersDelivered.add(`${subscriber.name}-${store.$id}`)

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

            this.rewriteResetStore({ store } as PiniaPluginContext, JSON.stringify(store.$state), Object.assign({}, store))
        } catch (e) {
            this.logError(e, store, options)
        }
    }

    private rewriteResetStore({ store }: PiniaPluginContext, initState: string, customStore: AnyObject): void {
        store.$reset = () => {
            this.debugLog('rewriteResetStore()', { initState, store, customStore })

            this.executeResetStoreCallbacks(store)

            store.$patch(JSON.parse(initState))
        }
    }

    private storeOnActionSubscription(subscription: StoreOnActionSubscription): void {
        const { store, callback } = subscription()

        store.$onAction(({ after, args, name }) => {
            this.debugLog(`storeOnActionSubscription ${store.$id}`, { after, args, name, store })
            callback({ after, args, name })
        })
    }

    private storeMutationSubscription(subscription: StoreMutationSubscription): void {
        const { store, callback } = subscription()

        store.$subscribe((mutation: SubscriptionCallbackMutation<StateTree>) => {
            this.debugLog(`$subscribe ${store.$id}`, { mutation, store })
            callback(mutation)
        })
    }

    private subscriptionDelivery({ store, options }: PiniaPluginContext, pluginSubscriptions: PluginSubscriptions): void {
        Object.entries(pluginSubscriptions).forEach(([pluginName, pluginSubscription]) => {
            try {
                if (this._subscriptionsDelivered.has(`${pluginName}-${store.$id}`)) {
                    return
                }

                const { subscription, subscriptionOptions, stores } = pluginSubscription

                this.debugLog(`subscriptionDelivery() - store: ${store.$id}`, [
                    'pluginName:', pluginName,
                    'subscription:', subscription,
                    'options:', pluginSubscription,
                    'stores:', stores
                ])

                const pluginOptions = {
                    storeOptions: { ...((options as AnyObject)?.storeOptions ?? {}), ...subscriptionOptions }
                } as AnyObject

                subscription.invoke(
                    { store, options: { ...options, ...pluginOptions } } as PiniaPluginContext,
                    this.debug
                )
                this._subscriptionsDelivered.add(`${pluginName}-${store.$id}`)

                if (!isEmpty(stores)) {
                    stores?.forEach(
                        store => subscription.invoke(
                            {
                                store,
                                options: {
                                    ...options,
                                    ...pluginOptions,
                                    ...((store as AnyObject)?.storeOptions ?? {})
                                }
                            } as PiniaPluginContext,
                            this.debug
                        )
                    )
                }
            } catch (e) {
                this.logError(`subscriptionDelivery()`, e, store, options)
            }
        })
    }
}