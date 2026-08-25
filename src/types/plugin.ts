import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { StoreOptions } from "./store"
import type { Console, PluginSubscriberInterface } from "."

export type PluginHydrationScheduler = (callback: () => void) => void

export type PluginHydrationTiming = 'defer' | 'immediate'

export type PluginRuntimeEnvironment = 'client' | 'server'

export type PluginExecutionEnvironment = PluginRuntimeEnvironment | 'both'

export interface PluginExecutionOptions {
    environment?: PluginExecutionEnvironment
    hydration?: PluginHydrationTiming
}

export interface PluginSubscriptionOptions {
    debug?: string[]
    execution?: PluginExecutionOptions
    hydrationScheduler?: PluginHydrationScheduler
    runtimeEnvironment?: PluginRuntimeEnvironment
    subscriberExecution?: Record<string, PluginExecutionOptions>
}

export interface PluginSubscriber {
    console?: Console
    execution?: PluginExecutionOptions
    hydrate?: (context: PiniaPluginContext, debug: boolean) => void | Promise<void>
    hydrationScheduler?: PluginHydrationScheduler
    invoke: (context: PiniaPluginContext, debug: boolean) => boolean
    name: string
    resetStoreCallback?: (store?: Store) => void
    storeOnActionSubscription?: StoreOnActionSubscription
    storeMutationSubscription?: StoreMutationSubscription
    subscriptions?: PluginSubscriptions
    afterHydration?: (context: PiniaPluginContext, debug: boolean) => void | Promise<void>
}

export interface NativePiniaSubscriptionReturn<Callback> {
    store: Store
    callback: Callback
}

export interface StoreOnActionCallbackParameters {
    after: Function
    args: any[] | object
    name: string
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