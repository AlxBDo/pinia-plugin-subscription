import type { PiniaPluginContext, StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { StoreOptions } from "./store"


export type CreateStateSnapshotKeys = (keyof StateTree)[] | 'all'