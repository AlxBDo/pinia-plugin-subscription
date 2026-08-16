import type { AnyObject } from ".";
import type { _StoreWithGetters, PiniaCustomProperties, Store, StoreDefinition } from "pinia";
import type { Ref } from "vue";

export type CustomStore<TStore, TState> = Store & TStore & TState & PiniaCustomProperties & StoreDefinition

export type EmptyExtensions = Record<never, never>

export interface DefineAStoreSetupExtensions<TEnhancedStore> {
    /**
     * @deprecated Use enhancedStore instead.
     */
    extending?: TEnhancedStore
    enhancedStore?: TEnhancedStore
}

export interface DefineAStoreSetupContext<
    TEnhancedStore,
    TExtraExtensions extends Record<string, unknown> = EmptyExtensions
> {
    id: string
    extensions: DefineAStoreSetupExtensions<TEnhancedStore> & TExtraExtensions
}

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