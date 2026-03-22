export interface AnyObject {
    [key: number | string | symbol]: any;
}
export interface SearchCollectionCriteria {
    [key: number | string | symbol]: boolean | number | string;
}

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
    StoreMutationSubscriptionCallback,
    StoreOnActionCallbackParameters
} from "./plugin"