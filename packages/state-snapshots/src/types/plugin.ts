import type { StateTree } from "pinia"
import type { Ref } from "vue"
import type { StateRestoredStoreOptions, RollbackActionParams } from "./store"


export type CreateStateSnapshotKeys = (keyof StateTree)[] | 'all'

export interface StateSnapshot {
    all: boolean
    keys: string[]
    refs: Map<string, Ref>
    values: StateTree
}


declare module 'pinia-plugin-subscription/types' {
    interface StoreOptionsExtensions extends StateRestoredStoreOptions { }
}

declare module 'pinia' {
    interface PiniaCustomProperties {
        $rollbackAfterFailure: (params: RollbackActionParams, args?: any[]) => Promise<void>
    }
}