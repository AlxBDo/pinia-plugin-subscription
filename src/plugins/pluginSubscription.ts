import Debug from "../system/Debug"
import { PluginConsole } from "../system/log"
import { isEmpty } from "../utils/validation"

import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { AnyObject } from "../types"
import type {
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginRuntimeEnvironment,
    PluginSubscriber,
    PluginSubscription as PluginSubscriptionDefinition,
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreOnActionSubscription
} from "../types/plugin"

const className = 'PluginSubscription'
const defaultPluginExecution: Required<PluginExecutionOptions> = {
    environment: 'both',
    hydration: 'immediate'
}

function defaultHydrationScheduler(callback: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => globalThis.setTimeout(callback, 0))
        return
    }

    globalThis.setTimeout(callback, 0)
}

function cloneState<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        } catch {
            // fall through to the safe manual clone below
        }
    }

    if (value === null || typeof value !== 'object') {
        return value
    }

    if (Array.isArray(value)) {
        return value.map(item => cloneState(item)) as T
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneState(item)])
    ) as T
}

function isPluginSubscriptionOptions(
    value: PluginSubscriptionOptions | string[] | undefined
): value is PluginSubscriptionOptions {
    return value !== undefined && !Array.isArray(value)
}


export default class PluginSubscription extends Debug {
    protected _className: string = className
    private _hydrationScheduler: PluginHydrationScheduler
    private _options?: PluginSubscriptionOptions
    private _pluginDebug?: string[]
    private _resetStoreCallback: Function[] = []
    private _subscribers: PluginSubscriber[] = []
    private _subscribersDelivered: Set<string> = new Set()
    private _subscribersScheduled: Set<string> = new Set()
    private _subscriptions: PluginSubscriptions[] = []
    private _subscriptionsDelivered: Set<string> = new Set()
    private _subscriptionsScheduled: Set<string> = new Set()

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }

    get subscriptions(): PluginSubscriptions[] | undefined {
        if (!isEmpty(this._subscriptions)) {
            return this._subscriptions
        }
    }

    constructor(
        subscribers: PluginSubscriber[],
        debugOrOptions?: PluginSubscriptionOptions | string[],
        pluginOptions?: PluginSubscriptionOptions
    ) {
        const debug = Array.isArray(debugOrOptions) ? debugOrOptions : undefined
        const options = isPluginSubscriptionOptions(debugOrOptions) ? debugOrOptions : pluginOptions

        super(Array.isArray(debug) && !!debug?.includes(className), PluginConsole)
        this._hydrationScheduler = options?.hydrationScheduler ?? defaultHydrationScheduler
        this._options = options
        this._pluginDebug = Array.isArray(debug) ? debug : undefined
        this._subscribers = subscribers
    }


    private addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    private defineCurrentEnvironment(): PluginRuntimeEnvironment {
        return this._options?.runtimeEnvironment
            ?? (typeof window === 'undefined' ? 'server' : 'client')
    }

    private definePluginDebug(subscriber: PluginSubscriber): boolean {
        return !!this._pluginDebug?.includes(subscriber.name)
    }

    private definePluginExecution(subscriber: PluginSubscriber): Required<PluginExecutionOptions> {
        return {
            ...defaultPluginExecution,
            ...(this._options?.execution ?? {}),
            ...(subscriber.execution ?? {}),
            ...(this._options?.subscriberExecution?.[subscriber.name] ?? {}),
        }
    }

    private defineHydrationScheduler(subscriber: PluginSubscriber | PluginSubscriptionDefinition['subscription']): PluginHydrationScheduler {
        return subscriber.hydrationScheduler ?? this._hydrationScheduler
    }

    private defineSubscriberKey(subscriber: PluginSubscriber, store: Store): string {
        return `${subscriber.name}-${store.$id}`
    }

    private defineSubscriptionKey(pluginName: string, store: Store): string {
        return `${pluginName}-${store.$id}`
    }

    private executeResetStoreCallbacks(store: Store): void {
        this._resetStoreCallback.forEach(callback => callback(store))
    }

    private executeSubscriber(context: PiniaPluginContext, subscriber: PluginSubscriber): void {
        const subscriberKey = this.defineSubscriberKey(subscriber, context.store)
        const debug = this.definePluginDebug(subscriber)

        if (this._subscribersDelivered.has(subscriberKey)) {
            return
        }

        if (
            !subscriber.invoke(
                context,
                debug
            )) {
            return
        }

        this._subscribersDelivered.add(subscriberKey)

        let hydrateResult: void | Promise<void>

        try {
            hydrateResult = subscriber.hydrate?.(context, debug)
        } catch (error) {
            this.logError(error, context.store, context.options)
            return
        }

        const runAfterHydration = () => {
            try {
                const afterHydration = subscriber.afterHydration?.(context, debug)
                if (afterHydration && typeof (afterHydration as Promise<void>).then === 'function') {
                    ;(afterHydration as Promise<void>).catch(error => this.logError(error, context.store, context.options))
                }
            } catch (error) {
                this.logError(error, context.store, context.options)
            }
        }

        if (hydrateResult && typeof (hydrateResult as Promise<void>).then === 'function') {
            ;(hydrateResult as Promise<void>)
                .then(() => runAfterHydration())
                .catch(error => this.logError(error, context.store, context.options))
        } else {
            runAfterHydration()
        }

        if (subscriber.subscriptions) {
            this.subscriptionDelivery(context, subscriber.subscriptions)
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

    private executeSubscriberSafely(context: PiniaPluginContext, subscriber: PluginSubscriber): void {
        try {
            this.executeSubscriber(context, subscriber)
        } catch (e) {
            this.logError(e, context.store, context.options)
        }
    }

    private queueSubscriberExecution(
        context: PiniaPluginContext,
        subscriber: PluginSubscriber,
        subscriberKey: string
    ): void {
        const scheduler = this.defineHydrationScheduler(subscriber)

        this._subscribersScheduled.add(subscriberKey)
        scheduler(() => {
            this._subscribersScheduled.delete(subscriberKey)
            this.executeSubscriberSafely(context, subscriber)
        })
    }

    private shouldInvokePlugin(execution: Required<PluginExecutionOptions>): boolean {
        const currentEnvironment = this.defineCurrentEnvironment()

        return execution.environment === 'both' || execution.environment === currentEnvironment
    }

    private shouldScheduleAfterHydration(execution: Required<PluginExecutionOptions>): boolean {
        return this.defineCurrentEnvironment() === 'client' && execution.hydration === 'defer'
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
                    const subscriberKey = this.defineSubscriberKey(subscriber, store)
                    const execution = this.definePluginExecution(subscriber)

                    if (
                        this._subscribersDelivered.has(subscriberKey)
                        || this._subscribersScheduled.has(subscriberKey)
                    ) {
                        return
                    }

                    if (!this.shouldInvokePlugin(execution)) {
                        return
                    }

                    if (this.shouldScheduleAfterHydration(execution)) {
                        this.queueSubscriberExecution({ store, options } as PiniaPluginContext, subscriber, subscriberKey)
                        return
                    }

                    this.executeSubscriber({ store, options } as PiniaPluginContext, subscriber)
                }
            )

            this.rewriteResetStore({ store } as PiniaPluginContext, cloneState(store.$state), Object.assign({}, store))
            this.registerStoreCleanup(store)
        } catch (e) {
            this.logError(e, store, options)
        }
    }

    private rewriteResetStore({ store }: PiniaPluginContext, initState: StateTree, customStore: AnyObject): void {
        const safeState = cloneState(initState)

        store.$reset = () => {
            this.debugLog('rewriteResetStore()', { initState: safeState, store, customStore })

            this.executeResetStoreCallbacks(store)

            store.$patch(cloneState(safeState))
        }
    }

    private registerStoreCleanup(store: Store): void {
        if (typeof store.$dispose !== 'function') {
            return
        }

        const dispose = store.$dispose.bind(store)
        const scopedStore = store as AnyObject

        if (scopedStore.__piniaPluginSubscriptionDisposed) {
            return
        }

        scopedStore.__piniaPluginSubscriptionDisposed = true
        store.$dispose = () => {
            this.clearStoreTracking(store)
            return dispose()
        }
    }

    private clearStoreTracking(store: Store): void {
        const suffix = `-${store.$id}`

        for (const key of Array.from(this._subscribersDelivered)) {
            if (key.endsWith(suffix)) {
                this._subscribersDelivered.delete(key)
            }
        }

        for (const key of Array.from(this._subscribersScheduled)) {
            if (key.endsWith(suffix)) {
                this._subscribersScheduled.delete(key)
            }
        }

        for (const key of Array.from(this._subscriptionsDelivered)) {
            if (key.endsWith(suffix)) {
                this._subscriptionsDelivered.delete(key)
            }
        }

        for (const key of Array.from(this._subscriptionsScheduled)) {
            if (key.endsWith(suffix)) {
                this._subscriptionsScheduled.delete(key)
            }
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

    private subscriptionDelivery(
        context: PiniaPluginContext,
        pluginSubscriptions: PluginSubscriptions
    ): void {
        Object.entries(pluginSubscriptions).forEach(([pluginName, pluginSubscription]) => {
            const subscriptionKey = this.defineSubscriptionKey(pluginName, context.store)
            const execution = this.definePluginExecution(pluginSubscription.subscription)

            if (
                this._subscriptionsDelivered.has(subscriptionKey)
                || this._subscriptionsScheduled.has(subscriptionKey)
            ) {
                return
            }

            if (!this.shouldInvokePlugin(execution)) {
                return
            }

            if (this.shouldScheduleAfterHydration(execution)) {
                const scheduler = this.defineHydrationScheduler(pluginSubscription.subscription)

                this._subscriptionsScheduled.add(subscriptionKey)
                scheduler(() => {
                    this._subscriptionsScheduled.delete(subscriptionKey)
                    this.subscriptionDeliverySafely(context, pluginName, pluginSubscription)
                })
                return
            }

            this.subscriptionDeliverySafely(context, pluginName, pluginSubscription)
        })
    }

    private subscriptionDeliverySafely(
        { store, options }: PiniaPluginContext,
        pluginName: string,
        pluginSubscription: PluginSubscriptionDefinition
    ): void {
        try {
            if (this._subscriptionsDelivered.has(this.defineSubscriptionKey(pluginName, store))) {
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
            this._subscriptionsDelivered.add(this.defineSubscriptionKey(pluginName, store))

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
    }
}