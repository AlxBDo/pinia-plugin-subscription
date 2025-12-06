export interface AnyObject {
    [key: number | string | symbol]: any;
}
export interface SearchCollectionCriteria {
    [key: number | string | symbol]: boolean | number | string;
}

export type {
    CustomStore,
    DefineAugmentedStore,
    PluginStoreOptions,
    StatePropertyValue,
    StoreOptions,
    StoreOptionsPropertyValue
} from "./store"

export type {
    CreatePluginOptions,
    PluginSubscriber
} from "./plugin"