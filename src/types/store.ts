import type { AnyObject } from ".";
import type { CreateStateSnapshotKeys } from "./plugin";
import type {
    _StoreWithGetters,
    Pinia,
    PiniaCustomProperties,
    StateTree,
    Store,
    StoreDefinition,
    StoreGeneric
} from "pinia";
import type { Ref } from "vue";

export type CustomStore<TStore, TState> = Store & TStore & TState & PiniaCustomProperties & StoreDefinition

/**
 * Store definition returned by `defineAStore`/`defineAStoreCtx` when explicit
 * store/state types are provided, e.g. for stores augmented by plugins with
 * members not returned by the setup function.
 *
 * The call signature exposes `TStore` (actions/getters) and `TState` (state)
 * with precise typings so IDEs list store members and display action
 * prototypes. It extends pinia's `StoreDefinition` to stay assignable
 * wherever a standard store definition is expected.
 */
export interface DefineAStoreDefinition<TStore, TState, Id extends string = string> extends StoreDefinition<Id, StateTree & TState> {
    /**
     * Returns a store, creates it if necessary.
     *
     * @param pinia - Pinia instance to retrieve the store
     * @param hot - dev only hot module replacement
     */
    (pinia?: Pinia | null, hot?: StoreGeneric): Store<Id, StateTree & TState> & TStore
}

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

export interface RollbackActionParams {
    action: string
    stateKeys?: CreateStateSnapshotKeys
}

export type RollbackAfterFailureParams = { [key: string]: CreateStateSnapshotKeys }

export type StatePropertyValue = StdStatePropertyValue
    | Ref<StdStatePropertyValue>
    | StdStatePropertyValue[]
    | Ref<StdStatePropertyValue[]>
    | Ref<StdStatePropertyValue>[]

type StdStatePropertyValue = AnyObject | boolean | null | number | string | undefined

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

export interface StoreOptions extends StoreOptionsExtensions {
    [key: string]: StoreOptionsPropertyValue
    rollbackAfterFailure?: RollbackAfterFailureParams
}

export type StoreOptionsPropertyValue = OptionBaseProperty | OptionBaseProperty[] | ObjectBaseProperty | ObjectBaseProperty[]