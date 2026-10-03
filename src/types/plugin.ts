import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { StoreOptions } from "./store"
import type { PluginSubscriberInterface } from "."
import Tracer from "../system/Tracer"


export type CreateStateSnapshotKeys = (keyof StateTree)[] | 'all'

export type PluginHydrationScheduler = (callback: () => void) => void

export type PluginHydrationTiming = 'defer' | 'immediate'

export type PluginRuntimeEnvironment = 'client' | 'server'

export type PluginExecutionEnvironment = PluginRuntimeEnvironment | 'both'

export interface PluginExecutionOptions {
    environment?: PluginExecutionEnvironment
    hydration?: PluginHydrationTiming
}

export interface PluginSubscriptionOptions {
    createTracer?: (source: string) => Tracer
    execution?: PluginExecutionOptions
    hydrationScheduler?: PluginHydrationScheduler
    runtimeEnvironment?: PluginRuntimeEnvironment
    subscriberExecution?: Record<string, PluginExecutionOptions>
}

export interface PluginSubscriber {
    /**
     * Execution options for the plugin subscriber.
     * This determines how and when the plugin subscriber should be executed.
     */
    execution?: PluginExecutionOptions
    /**
     * Function to hydrate the plugin subscriber.
     * This is typically called during the hydration phase of the application.
     */
    hydrate?: (context: PiniaPluginContext) => void | Promise<void>
    /**
     * Scheduler for the hydration of the plugin subscriber.
     * This allows controlling when the hydration should occur.
     */
    hydrationScheduler?: PluginHydrationScheduler
    /**
     * Function to invoke the plugin subscriber.
     * Returns a boolean indicating whether the invocation was successful.
     */
    invoke: (context: PiniaPluginContext, createTracer?: (source: string) => Tracer) => boolean
    /**
     * Name of the plugin subscriber.
     */
    name: string
    /**
     * Callback to reset the store associated with the plugin subscriber.
     * This is typically used to clean up or reinitialize the store.
     */
    resetStoreCallback?: (store?: Store) => void
    /**
     * Subscription for store actions.
     * This is typically used to listen for and respond to actions dispatched in the store.
     */
    storeOnActionSubscription?: StoreOnActionSubscription
    /**
     * Subscription for store mutations.
     * This is typically used to listen for and respond to mutations committed in the store.
     */
    storeMutationSubscription?: StoreMutationSubscription
    /**
     * Subscriptions for the plugin subscriber.
     * This is typically used to manage and respond to various plugin-specific events or changes.
     */
    subscriptions?: PluginSubscriptions
    /**
     * Callback to be executed after the hydration of the plugin subscriber.
     * This is typically used to perform any post-hydration logic.
     */
    afterHydration?: (context: PiniaPluginContext) => void | Promise<void>
}

export interface NativePiniaSubscriptionReturn<Callback> {
    store: Store
    callback: Callback
}

export type StoreOnActionAfterCallbackParameter = (callback: (result?: unknown) => void) => void
export type StoreOnActionOnErrorCallbackParameter = (callback: (error: unknown) => void) => void

export interface StoreOnActionCallbackParameters {
    after: StoreOnActionAfterCallbackParameter
    args: any[] | object
    name: string
    onError?: StoreOnActionOnErrorCallbackParameter
}


export interface PluginSubscription {
    stores?: Store[]
    subscription: PluginSubscriberInterface
    subscriptionOptions?: StoreOptions
}

export type PluginSubscriptions = Record<string, PluginSubscription>

export type NativePiniaSubscription<Callback> = () => NativePiniaSubscriptionReturn<Callback>

export type StoreOnActionSubscriptionCallback = (params: StoreOnActionCallbackParameters) => void

export type StoreOnActionSubscriptionReturn = NativePiniaSubscriptionReturn<StoreOnActionSubscriptionCallback>

export type StoreOnActionSubscription = NativePiniaSubscription<StoreOnActionSubscriptionCallback>

export type StoreMutationSubscriptionCallback = (mutation: SubscriptionCallbackMutation<StateTree>) => void

export type StoreMutationSubscriptionReturn = NativePiniaSubscriptionReturn<StoreMutationSubscriptionCallback>

export type StoreMutationSubscription = NativePiniaSubscription<StoreMutationSubscriptionCallback>