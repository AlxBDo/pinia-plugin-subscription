import type { Store } from "pinia"
import type { CreateStateSnapshotKeys } from "./plugin";


export interface RollbackActionParams {
    action: string
    stateKeys?: CreateStateSnapshotKeys
}

export type RollbackAfterFailureParams = { [key: string]: CreateStateSnapshotKeys }

export type ResetStoreCallback = (store?: Store) => void

export interface StateRestoredStoreOptions {
    /**
     * Whether to override the default reset behavior for the store.
     */
    overrideReset?: boolean
    /**
     * Parameters for rolling back the store after a failure.
     */
    rollbackAfterFailure?: RollbackAfterFailureParams
}