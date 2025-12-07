import { defineStore } from "pinia"
import type { DefineStoreOptions, StateTree } from "pinia"
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
): DefineAugmentedStore<Sto, Sta> {
    const storeOptions: PluginStoreOptions = options ? { storeOptions: options } : {} as PluginStoreOptions

    return typeof storeDefinition === 'function'
        ? defineAStoreSetup(
            id,
            storeDefinition,
            storeOptions
        )
        : defineAStoreOptionApi(
            id,
            storeDefinition,
            storeOptions
        )
}

export function defineAStoreSetup<Sto, Sta>(
    id: string,
    storeDefinition: () => AnyObject,
    options: PluginStoreOptions
): DefineAugmentedStore<Sto, Sta> {
    return defineStore(id, storeDefinition, options as AnyObject) as unknown as DefineAugmentedStore<Sto, Sta>
}

export function defineAStoreOptionApi<Sto, Sta>(
    id: string,
    storeDefinition: Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'>,
    options?: PluginStoreOptions
): DefineAugmentedStore<Sto, Sta> {
    if (options) {
        storeDefinition = { ...storeDefinition, ...(options ?? {}) } as Omit<DefineStoreOptions<string, StateTree & Sta, AnyObject, Partial<Sto>>, 'id'>
    }

    return defineStore(id, storeDefinition) as unknown as DefineAugmentedStore<Sto, Sta>
}

const deniedFirstChar = new Set<string>(['_', '$'])

export function hasDeniedFirstChar(property: string): boolean {
    return deniedFirstChar.has(property[0] as string)
}