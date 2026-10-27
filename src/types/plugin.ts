import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { StoreOptions } from "./store"
import type { PluginSubscriberInterface } from "."
import Tracer from "../system/Tracer"
import type { TracerHandler } from "./trace"


export type CreateStateSnapshotKeys = (keyof StateTree)[] | 'all'

export type PluginHydrationScheduler = (callback: () => void) => void

export type PluginHydrationTiming = 'defer' | 'immediate'

export type PluginRuntimeEnvironment = 'client' | 'server'

export type PluginExecutionEnvironment = PluginRuntimeEnvironment | 'both'

export interface PluginExecutionOptions {
    /**
     * Execution environment for the plugin subscriber.
     * @type {PluginExecutionEnvironment | undefined}
     */
    environment?: PluginExecutionEnvironment
    /**
     * Hydration timing for the plugin subscriber.
     * @type {PluginHydrationTiming | undefined}
     */
    hydration?: PluginHydrationTiming
}

export interface PluginStoreOptions {
    /**
     * Store options for the plugin subscriber.
     * @type {StoreOptions}
     */
    storeOptions?: StoreOptions
}

export interface PluginSubscriptionOptions {
    /**
     * Tracer handler for the plugin subscriber.
     * This allows the plugin to interact with the tracing system.
     */
    tracerHandler?: TracerHandler

    /**
     * Execution options for the plugin subscriber.
     * This determines how and when the plugin subscriber should be executed.
     * @type {PluginExecutionOptions | undefined}
     */
    execution?: PluginExecutionOptions

    /**
     * Store options for the plugin subscriber.
     * @type {StoreOptions | undefined}
     */
    storeOptions?: StoreOptions

    /**
     * Hydration scheduler for the plugin subscriber.
     * @type {PluginHydrationScheduler | undefined}
     */
    hydrationScheduler?: PluginHydrationScheduler

    /**
     * Runtime environment for the plugin subscriber.
     * @type {PluginRuntimeEnvironment | undefined}
     */
    runtimeEnvironment?: PluginRuntimeEnvironment

    /**
     * Execution options for individual subscribers of the plugin.
     * This allows specifying different execution configurations for different subscribers.
     * @type {Record<string, PluginExecutionOptions> | undefined}
     */
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
    invoke: PluginSubscriberInvoke

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

export type PluginSubscriberInvoke = (context: PiniaPluginContext, createTracer?: (source: string) => Tracer) => boolean

/**
 * Return type for native Pinia subscriptions.
 * @template Callback - The type of the callback function for the subscription.
 */
export interface NativePiniaSubscriptionReturn<Callback> {
    /**
     * The store associated with the subscription.
     * @type {Store}
     */
    store: Store

    /**
     * The callback function for the subscription.
     * @type {Callback}
     */
    callback: Callback
}

export type StoreClassConstructorParams = Omit<PluginSubscriptionOptions, 'createTracer'>
    & {
        createTracer?: () => Tracer
        storeOptions?: StoreOptions
    }

export type StoreOnActionAfterCallbackParameter = (callback: (result?: unknown) => void) => void
export type StoreOnActionOnErrorCallbackParameter = (callback: (error: unknown) => void) => void

export interface StoreOnActionCallbackParameters {
    /**
     * Callback to be executed after the action is completed.
     * @type {StoreOnActionAfterCallbackParameter}
     */
    after: StoreOnActionAfterCallbackParameter

    /**
     * The arguments passed to the action.
     * @type {any[] | object}
     */
    args: any[] | object

    /**
     * The name of the action being subscribed to.
     * @type {string}
     */
    name: string

    /**
     * Callback to be executed if an error occurs during the action.
     * @type {StoreOnActionOnErrorCallbackParameter}
     */
    onError: StoreOnActionOnErrorCallbackParameter
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

export type StoreOnActionSubscription = (context: PiniaPluginContext) => StoreOnActionSubscriptionReturn

export type StoreMutationSubscriptionCallback = (mutation: SubscriptionCallbackMutation<StateTree>) => void

export type StoreMutationSubscriptionReturn = NativePiniaSubscriptionReturn<StoreMutationSubscriptionCallback>

export type StoreMutationSubscription = NativePiniaSubscription<StoreMutationSubscriptionCallback>