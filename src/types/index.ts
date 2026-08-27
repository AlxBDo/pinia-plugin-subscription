import type {
    PiniaPluginContext,
    StateTree,
    Store as PiniaStore,
    SubscriptionCallbackMutation
} from 'pinia'
import type { Ref } from 'vue'
import type {
    NativePiniaSubscription,
    NativePiniaSubscriptionReturn,
    PluginExecutionEnvironment,
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginHydrationTiming,
    PluginRuntimeEnvironment,
    PluginSubscriber,
    PluginSubscription,
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreMutationSubscriptionCallback,
    StoreMutationSubscriptionReturn,
    StoreOnActionCallbackParameters,
    StoreOnActionSubscription,
    StoreOnActionSubscriptionCallback,
    StoreOnActionSubscriptionReturn,
} from './plugin'
import type {
    CustomStore,
    DefineAStoreSetupContext,
    DefineAStoreSetupExtensions,
    EmptyExtensions,
    PluginStoreOptions,
    StatePropertyValue,
    StoreOptions,
    StoreOptionsPropertyValue,
} from './store'

export interface AnyObject {
    [key: number | string | symbol]: any
}

export interface SearchCollectionCriteria {
    [key: number | string | symbol]: boolean | number | string
}

export interface Console {
    log(...args: any): void
    error(...args: any): void
}

export type LogType = 'error' | 'info'
export type StyleDefinitionKeys = 'bgColor' | 'color' | 'icon'
export type StyleDefinition = Record<StyleDefinitionKeys, string>
export type StyleDefinitions = Record<LogType, Record<StyleDefinitionKeys, string>>
export type ConsoleStyleDefinition = StyleDefinition
export type ConsoleStyleDefinitionKeys = StyleDefinitionKeys
export type ConsoleStyleDefinitions = StyleDefinitions

export type { List, ListTypes, ListTypesMap, PartialList } from './list'
export type { CustomStore, DefineAStoreSetupContext, DefineAStoreSetupExtensions, EmptyExtensions, PluginStoreOptions, StatePropertyValue, StoreOptions, StoreOptionsPropertyValue } from './store'
export type {
    NativePiniaSubscription,
    NativePiniaSubscriptionReturn,
    PluginExecutionEnvironment,
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginHydrationTiming,
    PluginRuntimeEnvironment,
    PluginSubscriber,
    PluginSubscription,
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreMutationSubscriptionCallback,
    StoreMutationSubscriptionReturn,
    StoreOnActionCallbackParameters,
    StoreOnActionSubscription,
    StoreOnActionSubscriptionCallback,
    StoreOnActionSubscriptionReturn,
} from './plugin'

export interface PluginSubscriberInterface {
    console?: Console
    execution?: PluginExecutionOptions
    hydrate?: (context: PiniaPluginContext, debug: boolean) => void | Promise<void>
    hydrationScheduler?: PluginHydrationScheduler
    invoke: (context: PiniaPluginContext, debug: boolean) => boolean
    name: string
    resetStoreCallback?: (store?: PiniaStore) => void
    storeOnActionSubscription?: StoreOnActionSubscription
    storeMutationSubscription?: StoreMutationSubscription
    subscriptions?: PluginSubscriptions
    afterHydration?: (context: PiniaPluginContext, debug: boolean) => void | Promise<void>
}

export interface PluginSubscriptionDefinition {
    stores?: PiniaStore[]
    subscription: PluginSubscriberInterface
    subscriptionOptions?: StoreOptions
}
