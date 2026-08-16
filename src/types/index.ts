import type {
    DefineStoreOptions,
    PiniaCustomProperties,
    PiniaPlugin,
    PiniaPluginContext,
    StateTree,
    Store as PiniaStore,
    SubscriptionCallbackMutation,
    StoreDefinition
} from "pinia"
import type { Ref } from "vue"

export interface AnyObject {
    [key: number | string | symbol]: any;
}
export interface SearchCollectionCriteria {
    [key: number | string | symbol]: boolean | number | string;
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

type OptionBaseProperty = string | number | boolean | null | undefined | object | Function

type ObjectBaseProperty = Record<string, OptionBaseProperty | OptionBaseProperty[]>

type StdStatePropertyValue = AnyObject | boolean | null | number | string | undefined

export type CustomStore<TStore, TState> = PiniaStore & TStore & TState & PiniaCustomProperties & StoreDefinition

export interface PluginStoreOptions {
    storeOptions: StoreOptions
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

export type StatePropertyValue = StdStatePropertyValue
    | Ref<StdStatePropertyValue>
    | StdStatePropertyValue[]
    | Ref<StdStatePropertyValue[]>
    | Ref<StdStatePropertyValue>[]

export type StoreOptions = Record<string, StoreOptionsPropertyValue>

export type StoreOptionsPropertyValue = OptionBaseProperty | OptionBaseProperty[] | ObjectBaseProperty | ObjectBaseProperty[]

export interface NativePiniaSubscriptionReturn<Callback> {
    store: PiniaStore
    callback: Callback
}

export interface StoreOnActionCallbackParameters {
    after: Function
    args: any[] | object
    name: string
}

export interface PluginSubscriberInterface {
    console?: Console
    invoke: (context: PiniaPluginContext, debug: boolean) => boolean
    name: string
    resetStoreCallback?: (store?: PiniaStore) => void
    storeOnActionSubscription?: StoreOnActionSubscription
    storeMutationSubscription?: StoreMutationSubscription
    subscriptions?: PluginSubscriptions
}

export interface PluginSubscriptionDefinition {
    stores?: PiniaStore[]
    subscription: PluginSubscriberInterface
    subscriptionOptions?: StoreOptions
}

export type PluginSubscriptions = Record<string, PluginSubscriptionDefinition>

export type NativePiniaSubscription<Callback> = () => NativePiniaSubscriptionReturn<Callback>

export type StoreOnActionSubscriptionCallback = (params: StoreOnActionCallbackParameters) => void

export type StoreOnActionSubscription = NativePiniaSubscription<StoreOnActionSubscriptionCallback>

export type StoreMutationSubscriptionCallback = (mutation: SubscriptionCallbackMutation<StateTree>) => void

export type StoreMutationSubscription = NativePiniaSubscription<StoreMutationSubscriptionCallback>

export declare const PLUGIN_NAME: string

export declare function createPlugin(subscribers: PluginSubscriberInterface[], debug?: string[]): PiniaPlugin

export declare function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition: Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'>,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export declare function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition: (ctx?: DefineAStoreSetupContext<AnyObject>) => AnyObject,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export declare function defineAStoreCtx<Sto, Sta>(
    id: string,
    storeDefinition: (ctx: DefineAStoreSetupContext<Sto & Sta>) => AnyObject,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export declare function defineAStoreCtx<Sto, Sta, TExtraExtensions extends Record<string, unknown>>(
    id: string,
    storeDefinition: (ctx: DefineAStoreSetupContext<Sto & Sta, TExtraExtensions>) => AnyObject,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export declare function getDefineAStoreSetupContext(store: AnyObject): DefineAStoreSetupContext<AnyObject> | undefined

export declare function getEnhancedStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>
): TEnhancedStore

export declare function setEnhancedStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>,
    store: TEnhancedStore
): void

/**
 * @deprecated Use getEnhancedStore instead.
 */
export declare function getExtendingStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>
): TEnhancedStore

export declare function isEmpty(value: any): boolean

export declare abstract class Debug {
    protected abstract _className: string
    console: Console
    debug: boolean

    constructor(debug: boolean, customConsole?: Console)

    debugLog(...args: any): void
    logError(...args: any): void
}

export declare abstract class CustomConsole implements Console {
    protected _bgColor: string
    protected _color: string
    protected _icon: string
    protected _errorBgColor: string
    protected _errorColor: string
    protected _errorIcon: string
    protected abstract _pluginName: string

    log(...args: any): void
    error(...args: any): void
}

export declare abstract class PluginSubscriber<Instance extends Store> implements PluginSubscriberInterface {
    console: Console
    name: string
    pluginOptions: AnyObject
    resetStoreCallback?: (store?: PiniaStore) => void
    storeOnActionSubscription?: StoreOnActionSubscription
    storeMutationSubscription?: StoreMutationSubscription
    subscriptions?: PluginSubscriptions
    protected pluginCreated?: (store: PiniaStore) => void
    protected _resetStoreCallback?: (store?: PiniaStore) => void

    constructor(
        pluginName: string,
        createInstanceFunction: (store: PiniaStore, options: AnyObject, debug: boolean, customConsole?: Console) => Instance | undefined,
        pluginConsole?: Console
    )

    invoke(context: PiniaPluginContext, debug: boolean): boolean
}

export declare class PluginSubscription extends Debug {
    protected _className: string

    constructor(subscribers: PluginSubscriberInterface[], debug?: string[])

    plugin(context: PiniaPluginContext): void
}

export declare class Store extends Debug {
    protected static _requiredKeys?: string[]
    protected _className: string
    onAction: StoreOnActionSubscription | undefined
    readonly options: StoreOptions
    state: StateTree
    storeSubscribe: StoreMutationSubscriptionCallback | undefined
    readonly store: AnyObject

    constructor(store: PiniaStore, options: AnyObject, debug?: boolean, customConsole?: Console)

    addSubscription(
        pluginName: string,
        subscription: PluginSubscriberInterface,
        options?: { subscriptionOptions?: StoreOptions, stores?: PiniaStore[] }
    ): void

    addToState(name: string, value?: StatePropertyValue): void

    static customizeStore<Instance extends Store>(
        store: PiniaStore,
        options: AnyObject,
        debug?: boolean,
        customConsole?: Console
    ): Instance | undefined

    getOption(optionName: keyof StoreOptions): StoreOptionsPropertyValue
    getStatePropertyValue(propertyName: string): StatePropertyValue
    getSubscriptions(): PluginSubscriptions | undefined
    getValue(value: any): any
    hasDeniedFirstChar(property: string): boolean
    protected static hasRequiredKeys(options: AnyObject): boolean
    isOptionApi(): boolean
    stateHas(property: string): boolean
    storeHas(property: string): boolean
}

declare module 'pinia' {
    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}