import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"


export interface PluginSubscriber {
    invoke: (context: PiniaPluginContext, debug?: boolean) => void
    name: string
    resetStoreCallback?: (store?: Store) => void
    storeOnActionSubscription?: StoreOnActionSubscription
    storeMutationSubscription?: StoreMutationSubscription
    subscriptions: PluginSubscriptions | undefined
}

export interface NativePiniaSubscriptionReturn<Callback> {
    store: Store
    callback: Callback
}

export interface OnActionParameters {
    after: Function
    args: any[] | object
    name: string
}


export type PluginSubscription = (store?: Store) => Store[] | undefined

export type PluginSubscriptions = Record<string, PluginSubscription>

export type NativePiniaSubscription<Callback> = () => NativePiniaSubscriptionReturn<Callback>

export type StoreOnActionSubscriptionCallback = (params: OnActionParameters) => void

export type StoreOnActionSubscriptionReturn = NativePiniaSubscriptionReturn<StoreOnActionSubscriptionCallback>

export type StoreOnActionSubscription = NativePiniaSubscription<StoreOnActionSubscriptionCallback>

export type StoreMutationSubscriptionCallback = (mutation: SubscriptionCallbackMutation<StateTree>) => void

export type StoreMutationSubscriptionReturn = NativePiniaSubscriptionReturn<StoreMutationSubscriptionCallback>

export type StoreMutationSubscription = NativePiniaSubscription<StoreMutationSubscriptionCallback>