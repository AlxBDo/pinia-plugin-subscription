import { defineStore } from "pinia"
import type { DefineStoreOptions, StateTree, StoreDefinition } from "pinia"
import type { AnyObject } from "../types"
import type { DefineAStoreSetupContext, PluginStoreOptions, StoreOptions } from "../types/store"


export const itemState = {
    '@id': undefined,
    id: undefined
}

type DefineAStoreSetup = (ctx?: DefineAStoreSetupContext) => AnyObject

const defineAStoreSetupContexts = new WeakMap<AnyObject, DefineAStoreSetupContext>()
const defineAStoreSetupContextsById = new Map<string, DefineAStoreSetupContext>()

export function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition: Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'> | DefineAStoreSetup,
    options?: StoreOptions
): StoreDefinition & Sta & Sto {
    const storeOptions: PluginStoreOptions = options ? { storeOptions: options } : {} as PluginStoreOptions

    return (typeof storeDefinition === 'function'
        ? defineAStoreSetup(
            id,
            storeDefinition,
            storeOptions
        )
        : defineAStoreOptionApi(
            id,
            storeDefinition,
            storeOptions
        )) as StoreDefinition & Sta & Sto
}

export function getDefineAStoreSetupContext(store: AnyObject): DefineAStoreSetupContext | undefined {
    return defineAStoreSetupContexts.get(store)
        ?? (typeof store?.$id === 'string'
            ? defineAStoreSetupContextsById.get(store.$id)
            : undefined)
}

export function defineAStoreSetup(
    id: string,
    storeDefinition: DefineAStoreSetup,
    options: PluginStoreOptions
) {
    const setupContext: DefineAStoreSetupContext = {
        id,
        extensions: {}
    }
    defineAStoreSetupContextsById.set(id, setupContext)
    const useStore = defineStore(id, () => storeDefinition(setupContext), options as AnyObject)

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