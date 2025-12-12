import type { AnyObject } from ".";
import type { _StoreWithGetters, PiniaCustomProperties, Store, StoreDefinition } from "pinia";
import type { Ref } from "vue";

export type CustomStore<TStore, TState> = Store & PiniaCustomProperties & StoreDefinition<string, AnyObject & TState, AnyObject, TStore> & TStore & TState

export type DefineAugmentedStore<TStore, TState> = (args?: any) => CustomStore<TStore, TState>

export type ObjectBaseProperty = Record<string, OptionBaseProperty | OptionBaseProperty[]>

export type OptionBaseProperty = string | number | boolean | null | undefined | object | Function

export interface PluginStoreOptions {
    storeOptions: StoreOptions
}

export type StatePropertyValue = StdStatePropertyValue
    | Ref<StdStatePropertyValue>
    | StdStatePropertyValue[]
    | Ref<StdStatePropertyValue[]>
    | Ref<StdStatePropertyValue>[]

type StdStatePropertyValue = AnyObject | boolean | null | number | string | undefined

export type StoreOptions = Record<string, StoreOptionsPropertyValue>

export type StoreOptionsPropertyValue = OptionBaseProperty | OptionBaseProperty[] | ObjectBaseProperty | ObjectBaseProperty[]