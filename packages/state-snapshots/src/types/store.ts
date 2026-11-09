import type { Store } from "pinia"
import type { CreateStateSnapshotKeys } from "./plugin";


export interface RollbackActionParams {
    action: string
    stateKeys?: CreateStateSnapshotKeys
}

export type RollbackAfterFailureParams = { [key: string]: CreateStateSnapshotKeys }

export interface StateRestoredStoreOptions {
    /**
     * Callback to reset the store associated with the plugin subscriber.
     * This is typically used to clean up or reinitialize the store.
     */
    onResetStore?: (store?: Store) => void
    /**
     * Whether to override the default reset behavior for the store.
     */
    overrideReset?: boolean
    /**
     * Parameters for rolling back the store after a failure.
     */
    rollbackAfterFailure?: RollbackAfterFailureParams
}