import type { StoreOptionsExtensions } from "pinia-plugin-subscription/types";
import type { CreateStateSnapshotKeys } from "./plugin";


export interface RollbackActionParams {
    action: string
    stateKeys?: CreateStateSnapshotKeys
}

export type RollbackAfterFailureParams = { [key: string]: CreateStateSnapshotKeys }


/**
 * Centralized extension point for per-store plugin options.
 *
 * Subscriber plugins MUST NOT redeclare pinia's `DefineStoreOptionsBase`:
 * merging a `storeOptions` property with a different (even compatible) type
 * raises TS2717 in consumer code. Instead, they augment this interface via
 * `declare module 'pinia-plugin-subscription/types'`, which merges safely as
 * long as each plugin declares its own optional keys.
 */
export type StoreOptions = StoreOptionsExtensions & {
    rollbackAfterFailure?: RollbackAfterFailureParams
}