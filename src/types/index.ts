import type { StoreOptions } from "./store"

export interface AnyObject {
    [key: number | string | symbol]: any;
}
export interface SearchCollectionCriteria {
    [key: number | string | symbol]: boolean | number | string;
}

export { createPlugin } from "../plugins/createPlugin"
export { defineAStore } from "../utils/store"
export { pluginName as PLUGIN_NAME } from "../utils/constantes"
export { default as Debug } from "../system/Debug"
export { CustomConsole } from "../system/log"
export { default as PluginSubscriber } from "../plugins/pluginSubscriber"
export { default as PluginSubscription } from "../plugins/pluginSubscription"
export { default as Store } from "../core/Store"
export { isEmpty } from "../utils/validation"

export {
    Console,
    LogType,
    StyleDefinition as ConsoleStyleDefinition,
    StyleDefinitionKeys as ConsoleStyleDefinitionKeys,
    StyleDefinitions as ConsoleStyleDefinitions
} from './log'

export type {
    CustomStore,
    PluginStoreOptions,
    StatePropertyValue,
    StoreOptions,
    StoreOptionsPropertyValue
} from "./store"

export type {
    PluginSubscriber as PluginSubscriberInterface,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreOnActionSubscription,
    StoreMutationSubscriptionCallback,
    StoreOnActionCallbackParameters
} from "./plugin"

declare module 'pinia' {
    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}