import { defineStore } from "pinia"
import type { DefineStoreOptions, StateTree, StoreDefinition } from "pinia"
import type { AnyObject } from "../types"
import type {
    DefineAStoreSetupContext,
    EmptyExtensions,
    PluginStoreOptions,
    StoreOptions
} from "../types/store"


export const itemState = {
    '@id': undefined,
    id: undefined
}

type DefineAStoreSetup<TEnhancedStore, TExtraExtensions extends Record<string, unknown> = EmptyExtensions> =
    (ctx: DefineAStoreSetupContext<TEnhancedStore, TExtraExtensions>) => AnyObject

const defineAStoreSetupContexts = new WeakMap<AnyObject, DefineAStoreSetupContext<AnyObject>>()
const defineAStoreSetupContextsById = new Map<string, DefineAStoreSetupContext<AnyObject>>()

export function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition:
        Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'>
        | ((ctx?: DefineAStoreSetupContext<AnyObject>) => AnyObject),
    options?: StoreOptions
): StoreDefinition & Sta & Sto {
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
        )) as StoreDefinition & Sta & Sto
}

export function defineAStoreCtx<Sto, Sta>(
    id: string,
    storeDefinition: DefineAStoreSetup<Sto & Sta>,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export function defineAStoreCtx<Sto, Sta, TExtraExtensions extends Record<string, unknown>>(
    id: string,
    storeDefinition: DefineAStoreSetup<Sto & Sta, TExtraExtensions>,
    options?: StoreOptions
): StoreDefinition & Sta & Sto

export function defineAStoreCtx<Sto, Sta, TExtraExtensions extends Record<string, unknown> = EmptyExtensions>(
    id: string,
    storeDefinition: DefineAStoreSetup<Sto & Sta, TExtraExtensions>,
    options?: StoreOptions
): StoreDefinition & Sta & Sto {
    const storeOptions: PluginStoreOptions = options
        ? { storeOptions: { ...options, enhanceStore: true } }
        : {} as PluginStoreOptions

    return defineAStoreSetup(
        id,
        storeDefinition as DefineAStoreSetup<AnyObject>,
        storeOptions
    ) as StoreDefinition & Sta & Sto
}

export function defineAStoreSetup(
    id: string,
    storeDefinition: DefineAStoreSetup<AnyObject>,
    options: PluginStoreOptions
) {
    const setupContext: DefineAStoreSetupContext<AnyObject> = {
        id,
        extensions: {}
    }
    defineAStoreSetupContextsById.set(id, setupContext)
    const useStore = defineStore(id, () => storeDefinition(setupContext), options as PluginStoreOptions)

    return Object.assign(((...args: Parameters<typeof useStore>) => {
        const store = useStore(...args)
        defineAStoreSetupContexts.set(store as AnyObject, setupContext)
        return store
    }) as typeof useStore, useStore)
}

export function defineAStoreOptionApi(
    id: string,
    storeDefinition: AnyObject,
    options?: PluginStoreOptions
) {
    if (options) {
        storeDefinition = { ...storeDefinition, ...(options ?? {}) }
    }

    return defineStore(id, storeDefinition)
}

const deniedFirstChar = new Set<string>(['_', '$'])

export function hasDeniedFirstChar(property: string): boolean {
    return deniedFirstChar.has(property[0] as string)
}

export function getDefineAStoreSetupContext(store: AnyObject): DefineAStoreSetupContext<AnyObject> | undefined {
    return defineAStoreSetupContexts.get(store)
        ?? (typeof store?.$id === 'string'
            ? defineAStoreSetupContextsById.get(store.$id)
            : undefined)
}

/**
 * Get the enhanced store from the context.
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
    return getEnhancedStore<TEnhancedStore>(ctx)
}