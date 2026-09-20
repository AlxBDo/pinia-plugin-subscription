import { defineStore } from "pinia"
import type {
    DefineSetupStoreOptions,
    DefineStoreOptions,
    SetupStoreDefinition,
    StateTree,
    Store,
    StoreDefinition,
    _ExtractActionsFromSetupStore,
    _ExtractGettersFromSetupStore,
    _ExtractStateFromSetupStore,
    _GettersTree
} from "pinia"
import type { AnyObject } from "../types"
import type {
    DefineAStoreDefinition,
    DefineAStoreSetupContext,
    EmptyExtensions,
    PluginStoreOptions,
    StoreOptions
} from "../types/store"


export const itemState = {
    '@id': undefined,
    id: undefined
}

type DefineAStoreSetup<SS, TExtraExtensions extends Record<string, unknown> = EmptyExtensions> =
    (ctx: DefineAStoreSetupContext<SS, TExtraExtensions>) => SS

/**
 * Options parameter of pinia's `defineStore()` for setup stores, derived from
 * the setup function return type.
 */
type DefineAStoreSetupOptions<Id extends string, SS> = DefineSetupStoreOptions<
    Id,
    _ExtractStateFromSetupStore<SS>,
    _ExtractGettersFromSetupStore<SS>,
    _ExtractActionsFromSetupStore<SS>
>

const defineAStoreSetupContexts = new WeakMap<object, DefineAStoreSetupContext<AnyObject>>()
const defineAStoreSetupContextsById = new Map<string, DefineAStoreSetupContext<AnyObject>>()
const setupContextDisposeWrappedStores = new WeakSet<object>()
const setupContextMapWarnThreshold = 50

function isSetupContextDebugEnabled(options: PluginStoreOptions): boolean {
    return options?.storeOptions?.debug === true
}

function logSetupContextMapSizes(id: string, options: PluginStoreOptions, action: string): void {
    if (!isSetupContextDebugEnabled(options)) {
        return
    }

    const setupContextByIdSize = defineAStoreSetupContextsById.size
    console.debug(`[defineAStoreSetup] ${id} - ${action} (contextsById=${setupContextByIdSize})`)

    if (setupContextByIdSize >= setupContextMapWarnThreshold) {
        console.warn(`[defineAStoreSetup] contextsById reached ${setupContextByIdSize} entries`)
    }
}

function registerSetupContextCleanupOnDispose(
    store: AnyObject,
    id: string,
    options: PluginStoreOptions
): void {
    if (setupContextDisposeWrappedStores.has(store) || typeof store.$dispose !== 'function') {
        return
    }

    const originalDispose = store.$dispose as (...args: unknown[]) => unknown
    store.$dispose = (...args: unknown[]) => {
        defineAStoreSetupContexts.delete(store)
        defineAStoreSetupContextsById.delete(id)
        logSetupContextMapSizes(id, options, 'dispose cleanup')
        return originalDispose.apply(store, args)
    }
    setupContextDisposeWrappedStores.add(store)
}

/**
 * Define a store with the setup API. State, getters and actions are inferred
 * from the setup function return, exactly like pinia's `defineStore`, so
 * store members are listed by IDEs and action prototypes are preserved.
 * @template Id The type of the store identifier.
 * @template SS The type of the setup function return.
 * @param id The unique identifier for the store.
 * @param storeDefinition The setup function defining the store.
 * @param options Optional store options.
 * @returns The defined store.
 */
export function defineAStore<Id extends string, SS>(
    id: Id,
    storeDefinition: (ctx?: DefineAStoreSetupContext<AnyObject>) => SS,
    options?: StoreOptions
): SetupStoreDefinition<Id, SS>
/**
 * Define a store with the options API, mirroring pinia's `defineStore` inference.
 * @template Id The type of the store identifier.
 * @template S The type of the store's state.
 * @template G The type of the store's getters.
 * @template A The type of the store's actions.
 * @param id The unique identifier for the store.
 * @param storeDefinition The store options definition.
 * @param options Optional store options.
 * @returns The defined store.
 */
export function defineAStore<Id extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(
    id: Id,
    storeDefinition: Omit<DefineStoreOptions<Id, S, G, A>, 'id'>,
    options?: StoreOptions
): StoreDefinition<Id, S, G, A>
/**
 * Define a store with explicit store/state types, e.g. when plugins augment
 * the store with members not returned by the setup function.
 * @template Sto The type of the store.
 * @template Sta The type of the store's state.
 * @param id The unique identifier for the store.
 * @param storeDefinition The store definition, either as an options object or a setup function.
 * @param options Optional store options.
 * @returns The defined store.
 */
export function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition:
        | Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'>
        | ((ctx?: DefineAStoreSetupContext<Sto & Sta>) => AnyObject),
    options?: StoreOptions
): DefineAStoreDefinition<Sto, Sta>
export function defineAStore(
    id: string,
    storeDefinition:
        | Omit<DefineStoreOptions<string, StateTree, AnyObject, AnyObject>, 'id'>
        | DefineAStoreSetup<AnyObject>,
    options?: StoreOptions
): StoreDefinition {
    const storeOptions: PluginStoreOptions = options ? { storeOptions: options } : {} as PluginStoreOptions

    return (typeof storeDefinition === 'function'
        ? defineAStoreSetup(
            id,
            storeDefinition as DefineAStoreSetup<AnyObject>,
            storeOptions
        )
        : defineAStoreOptionApi(
            id,
            storeDefinition,
            storeOptions
        )) as StoreDefinition
}

/**
 * Define a store with a required, fully typed setup context. State, getters
 * and actions are inferred from the setup function return.
 * @template Id The type of the store identifier.
 * @template SS The type of the setup function return.
 * @template TExtraExtensions The type of the store's extra extensions.
 * @param id The unique identifier for the store.
 * @param storeDefinition The setup function defining the store.
 * @param options Optional store options.
 * @returns The defined store with setup context.
 */
export function defineAStoreCtx<Id extends string, SS, TExtraExtensions extends Record<string, unknown> = EmptyExtensions>(
    id: Id,
    storeDefinition: (ctx: DefineAStoreSetupContext<AnyObject, TExtraExtensions>) => SS,
    options?: StoreOptions
): SetupStoreDefinition<Id, SS>
/**
 * Define a store with a setup context and explicit store/state types, e.g.
 * when plugins augment the store with members not returned by the setup function.
 * @template Sto The type of the store.
 * @template Sta The type of the store's state.
 * @template TExtraExtensions The type of the store's extra extensions.
 * @param id The unique identifier for the store.
 * @param storeDefinition The setup function defining the store.
 * @param options Optional store options.
 * @returns The defined store with setup context.
 */
export function defineAStoreCtx<Sto, Sta, TExtraExtensions extends Record<string, unknown> = EmptyExtensions>(
    id: string,
    storeDefinition: (ctx: DefineAStoreSetupContext<Sto & Sta, TExtraExtensions>) => AnyObject,
    options?: StoreOptions
): DefineAStoreDefinition<Sto, Sta>
export function defineAStoreCtx(
    id: string,
    storeDefinition: DefineAStoreSetup<AnyObject, any>,
    options?: StoreOptions
): StoreDefinition {
    const storeOptions: PluginStoreOptions = options
        ? { storeOptions: { ...options, enhancedStore: true } }
        : { storeOptions: { enhancedStore: true } } as PluginStoreOptions

    return defineAStoreSetup(
        id,
        storeDefinition,
        storeOptions
    ) as StoreDefinition
}

export function defineAStoreSetup<Id extends string, SS>(
    id: Id,
    storeDefinition: DefineAStoreSetup<SS>,
    options: PluginStoreOptions
): SetupStoreDefinition<Id, SS> {
    const setupContext: DefineAStoreSetupContext<SS> = {
        id,
        extensions: {}
    }

    const shouldStoreSetupContext = options?.storeOptions?.enhancedStore === true

    // `storeOptions` augments pinia's DefineStoreOptionsBase (see createPlugin.ts);
    // the assertion stays valid in compilation units where the augmentation is not loaded.
    const useStore = defineStore(
        id,
        () => storeDefinition(setupContext),
        options as unknown as DefineAStoreSetupOptions<Id, SS>
    )

    return Object.assign(((...args: Parameters<typeof useStore>) => {
        if (shouldStoreSetupContext) {
            defineAStoreSetupContextsById.set(id, setupContext as DefineAStoreSetupContext<AnyObject>)
            logSetupContextMapSizes(id, options, 'registered context by id')
        }

        const store = useStore(...args)

        if (shouldStoreSetupContext) {
            defineAStoreSetupContexts.set(store, setupContext as DefineAStoreSetupContext<AnyObject>)
            defineAStoreSetupContextsById.delete(id)
            logSetupContextMapSizes(id, options, 'moved context to weak map')
            registerSetupContextCleanupOnDispose(store as AnyObject, id, options)
        }

        return store
    }) as typeof useStore, useStore)
}

export function defineAStoreOptionApi<Id extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(
    id: Id,
    storeDefinition: Omit<DefineStoreOptions<Id, S, G, A>, 'id'>,
    options?: PluginStoreOptions
): StoreDefinition<Id, S, G, A> {
    if (options) {
        storeDefinition = { ...storeDefinition, ...(options ?? {}) }
    }

    return defineStore(id, storeDefinition)
}

const deniedFirstChar = new Set<string>(['_', '$'])

/**
 * Check if a property has a denied first character : ['_', '$'].
 * @param property The property name to check.
 * @returns True if the property has a denied first character, false otherwise.
 */
export function hasDeniedFirstChar(property: string): boolean {
    return deniedFirstChar.has(property[0] as string)
}

/**
 * Get the setup context associated with a store instance (or pending store id).
 * @param store The store instance, or an object exposing the store `$id`.
 * @returns The setup context when the store was defined with `enhancedStore` enabled, undefined otherwise.
 */
export function getDefineAStoreSetupContext(store: object): DefineAStoreSetupContext<AnyObject> | undefined {
    const storeRecord = store as AnyObject

    return defineAStoreSetupContexts.get(store)
        ?? (typeof storeRecord?.$id === 'string'
            ? defineAStoreSetupContextsById.get(storeRecord.$id)
            : undefined)
}

/**
 * Get the enhanced store from the context.
 * @template TEnhancedStore The type of the enhanced store.
 * @param ctx The context containing the extensions.
 * @returns The enhanced store casted to the specified types.
 */
export function getEnhancedStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>
): TEnhancedStore {
    const enhancedStore = ctx.extensions.enhancedStore ?? ctx.extensions.extending

    if (!enhancedStore) {
        throw new Error(`${ctx.id}Store - getEnhancedStore - Error: enhanced store is required`)
    }

    return enhancedStore
}

/**
 * Set the enhanced store in context with deprecated alias support.
 * @template TEnhancedStore The type of the enhanced store.
 * @param ctx The context containing the extensions.
 * @param store The store to expose as enhancement.
 */
export function setEnhancedStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>,
    store: TEnhancedStore
): void {
    ctx.extensions.enhancedStore = store
    ctx.extensions.extending = store
}

/**
 * @deprecated Use getEnhancedStore instead.
 */
export function getExtendingStore<TEnhancedStore>(
    ctx: DefineAStoreSetupContext<TEnhancedStore>
): TEnhancedStore {
    console.warn(`${ctx.id}Store - getExtendingStore is deprecated. Use getEnhancedStore instead.`)
    return getEnhancedStore<TEnhancedStore>(ctx)
}

/**
 * Get the storage key for a given action and store combination.
 * @param actionName The name of the action.
 * @param store The Pinia store instance.
 * @returns The storage key for the action and store combination.
 */
export function getActionStoreKey(actionName: string, store: Store): string {
    return `${actionName}-${store.$id}`
}