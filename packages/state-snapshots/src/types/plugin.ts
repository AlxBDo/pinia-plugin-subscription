import type { StateTree } from "pinia"
import type { Ref } from "vue"
import type { StateRestoredStoreOptions, RollbackActionParams, ResetStoreCallback } from "./store"


export type CreateStateSnapshotKeys = (keyof StateTree)[] | 'all'

export interface StateSnapshot {
    all: boolean
    keys: string[]
    refs: Map<string, Ref>
    values: StateTree
}