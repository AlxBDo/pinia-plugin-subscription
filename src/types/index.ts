import type { Store as PiniaStore } from 'pinia'

import type { PluginSubscriber as PluginSubscriberInterface } from './plugin'
import type { StoreOptions } from './store'

/**
 * Centralized extension point for per-store plugin options.
 *
 * Subscriber plugins MUST NOT redeclare pinia's `DefineStoreOptionsBase`:
 * merging a `storeOptions` property with a different (even compatible) type
 * raises TS2717 in consumer code. Instead, they augment this interface via
 * `declare module 'pinia-plugin-subscription/types'`, which merges safely as
 * long as each plugin declares its own optional keys.
 */
export interface StoreOptionsExtensions { } // eslint-disable-line @typescript-eslint/no-empty-object-type

export interface AnyObject {
    [key: number | string | symbol]: any
}

export type {
    TraceEvent,
    TraceEventMetadata,
    TraceHandler,
    TraceLevel,
    TracePayload,
    TraceSide,
    Tracer,
    TracerHandler
} from './trace'

export type {
    CustomStore,
    DefineAStoreSetupContext,
    DefineAStoreSetupExtensions,
    EmptyExtensions,
    RollbackActionParams,
    RollbackAfterFailureParams,
    StatePropertyValue,
    StoreOptions,
    StoreOptionsPropertyValue
} from './store'
export type {
    NativePiniaSubscription,
    NativePiniaSubscriptionReturn,
    PluginExecutionEnvironment,
    PluginExecutionOptions,
    PluginHydrationTiming,
    PluginRuntimeEnvironment,
    PluginStoreOptions,
    PluginSubscriberInvoke,
    PluginHydrationScheduler,
    PluginSubscription,
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreClassConstructorParams,
    StoreMutationSubscription,
    StoreMutationSubscriptionCallback,
    StoreMutationSubscriptionReturn,
    StoreOnActionCallbackParameters,
    StoreOnActionSubscription,
    StoreOnActionSubscriptionCallback,
    StoreOnActionSubscriptionReturn,
} from './plugin'

export type { PluginSubscriberInterface }

export interface PluginSubscriptionDefinition {
    stores?: PiniaStore[]
    subscription: PluginSubscriberInterface
    subscriptionOptions?: StoreOptions
}
