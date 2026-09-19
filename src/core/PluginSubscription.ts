import Debug from "../system/Debug"
import RollbackStateSnapshotsHandler from "./RollbackStateSnapshotsHandler"
import { deepClone } from '../utils/deep-clone'
import { getActionStoreKey } from '../utils/store'
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
    StoreOnActionAfterCallbackParameter,
    StoreOnActionSubscriptionCallback
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

function isPluginSubscriptionOptions(
    value: PluginSubscriptionOptions | string[] | undefined
): value is PluginSubscriptionOptions {
    return value !== undefined && !Array.isArray(value)
}


export default class PluginSubscription extends Debug {
    protected _className: string = className
    private _hydrationScheduler: PluginHydrationScheduler
    private _onActionSubscriptions: StoreOnActionSubscriptionCallback[] = []
    private _onActionAfterSubscriptions: Record<string, StoreOnActionAfterCallbackParameter[]> = {}
    private _onActionOnErrorSubscriptions: Record<string, Array<(error: unknown) => void>> = {}
    private _options?: PluginSubscriptionOptions
    private _pluginDebug?: string[]
    private _resetStoreCallback: Function[] = []
    private _storeRollbackSnapshotsHandler: RollbackStateSnapshotsHandler = new RollbackStateSnapshotsHandler()
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


    private addOnActionAfterCallback(actionName: string, store: Store, callback: StoreOnActionAfterCallbackParameter): void {
        const key = getActionStoreKey(actionName, store)
        if (!this._onActionAfterSubscriptions[key]) {
            this._onActionAfterSubscriptions[key] = []
        }
        this._onActionAfterSubscriptions[key]?.push(callback)
    }

    private addOnActionOnErrorCallback(actionName: string, store: Store, callback: (error: unknown) => void): void {
        const key = getActionStoreKey(actionName, store)
        if (!this._onActionOnErrorSubscriptions[key]) {
            this._onActionOnErrorSubscriptions[key] = []
        }
        this._onActionOnErrorSubscriptions[key]?.push(callback)
    }

    private addResetStoreCallback(callback: Function): void {
        this._resetStoreCallback.push(callback)
    }

    private clearOnActionCallbacksSubscriptions(storageKey: string): void {
        delete this._onActionAfterSubscriptions[storageKey]
        delete this._onActionOnErrorSubscriptions[storageKey]
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

        for (const key of Object.keys(this._onActionAfterSubscriptions)) {
            if (key.endsWith(suffix)) {
                delete this._onActionAfterSubscriptions[key]
            }
        }

        for (const key of Object.keys(this._onActionOnErrorSubscriptions)) {
            if (key.endsWith(suffix)) {
                delete this._onActionOnErrorSubscriptions[key]
            }
        }
    }

    /**
     * Creates a callback collector for the specified action and store.
     * @param actionName The name of the action to collect callbacks for.
     * @param store The store instance associated with the action.
     * @returns A function that collects callbacks for the specified action and store.
     */
    private createOnActionAfterCallbackCollector(actionName: string, store: Store) {
        return (callback: StoreOnActionAfterCallbackParameter) => {
            this.addOnActionAfterCallback(actionName, store, callback)
        }
    }

    /**
     * Creates a callback collector for the specified action and store that handles errors.
     * @param actionName The name of the action to collect error callbacks for.
     * @param store The store instance associated with the action.
     * @returns A function that collects error callbacks for the specified action and store.
     */
    private createOnActionOnErrorCallbackCollector(actionName: string, store: Store) {
        return (callback: (error: unknown) => void) => {
            this.addOnActionOnErrorCallback(actionName, store, callback)
        }
    }

    /**
     * Rolls back the state snapshot for a given action if an error occurs, and removes the snapshot after the action completes or fails.
     * @param actionName The name of the action being executed.
     * @param store The Pinia store instance.
     * @returns void
     */
    private createRollbackSnapshot(
        actionName: string,
        store: Store
    ) {
        const {
            after,
            onError
        } = this._storeRollbackSnapshotsHandler.createOnActionCallbacks(
            actionName,
            store
        ) ?? {}

        if (!after || !onError) {
            return
        }

        this.addOnActionAfterCallback(actionName, store, after)
        this.addOnActionOnErrorCallback(actionName, store, onError)
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

    /**
     * Executes the store's onAction subscription for the given plugin subscriber.
     * @param store The Pinia store instance.
     * @param subscriber The plugin subscriber.
     * @returns void
     */
    private executeStoreOnActionSubscription(store: Store): void {
        const onActionSubscriptions = this._onActionSubscriptions
        const hasRollbackSnapshots = this._storeRollbackSnapshotsHandler.storeHasRollbackSnapshots(store)

        if (!onActionSubscriptions?.length && !hasRollbackSnapshots) {
            return
        }

        store.$onAction(({ after, args, name, onError }) => {
            const storageKey = getActionStoreKey(name, store)
            this.debugLog(`storeOnActionSubscription ${storageKey}`, { args, name, store })

            if (hasRollbackSnapshots) {
                this.createRollbackSnapshot(name, store)
            }

            if (onActionSubscriptions?.length) {
                onActionSubscriptions.forEach(callback => callback({
                    after: this.createOnActionAfterCallbackCollector(name, store),
                    args,
                    name,
                    onError: this.createOnActionOnErrorCallbackCollector(name, store)
                }))
            }

            const afterCallbacks = this._onActionAfterSubscriptions[storageKey]
            const onErrorCallbacks = this._onActionOnErrorSubscriptions[storageKey]

            this.clearOnActionCallbacksSubscriptions(storageKey)

            if (afterCallbacks?.length) {
                after((result) => {
                    afterCallbacks.forEach(callback => callback(result))
                })
            }
            if (onErrorCallbacks?.length) {
                onError((error) => {
                    onErrorCallbacks.forEach(callback => callback(error))
                })
            }
        })
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
                    ; (afterHydration as Promise<void>).catch(error => this.logError(error, context.store, context.options))
                }
            } catch (error) {
                this.logError(error, context.store, context.options)
            }
        }

        if (hydrateResult && typeof (hydrateResult as Promise<void>).then === 'function') {
            ; (hydrateResult as Promise<void>)
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

        this.storeOnActionSubscription(subscriber)

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

            this.rewriteResetStore({ store } as PiniaPluginContext, store.$state)
            this._storeRollbackSnapshotsHandler.initFromPluginContext({ store, options } as PiniaPluginContext)
            this.executeStoreOnActionSubscription(store)
            this.registerStoreCleanup(store)
        } catch (e) {
            this.logError(e, store, options)
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

    private registerStoreCleanup(store: Store): void {
        this._onActionSubscriptions = []
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
            this._storeRollbackSnapshotsHandler.clearStoreTracking(store)
            return dispose()
        }
    }

    private rewriteResetStore({ store }: PiniaPluginContext, initState: StateTree): void {
        const safeState = deepClone(initState)

        store.$reset = () => {
            this.debugLog('rewriteResetStore()', { initState: safeState, store })

            this.executeResetStoreCallbacks(store)

            store.$patch(deepClone(safeState))
        }
    }

    private shouldInvokePlugin(execution: Required<PluginExecutionOptions>): boolean {
        const currentEnvironment = this.defineCurrentEnvironment()

        return execution.environment === 'both' || execution.environment === currentEnvironment
    }

    private shouldScheduleAfterHydration(execution: Required<PluginExecutionOptions>): boolean {
        return this.defineCurrentEnvironment() === 'client' && execution.hydration === 'defer'
    }

    private storeOnActionSubscription(subscriber: PluginSubscriber): void {
        const { store, callback } = subscriber?.storeOnActionSubscription?.() ?? {}

        if (!store || !callback) {
            return
        }

        this._onActionSubscriptions.push(callback)
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