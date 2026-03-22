import { defineStore } from "pinia"
import type { DefineStoreOptions, StateTree, StoreDefinition } from "pinia"
import type { AnyObject } from "../types"
import type { DefineAugmentedStore, PluginStoreOptions, StoreOptions } from "../types/store"


export const itemState = {
    '@id': undefined,
    id: undefined
}

export function defineAStore<Sto, Sta>(
    id: string,
    storeDefinition: Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'> | (() => AnyObject),
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

export function defineAStoreSetup(
    id: string,
    storeDefinition: () => AnyObject,
    options: PluginStoreOptions
) {
    return defineStore(id, storeDefinition, options as AnyObject)
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