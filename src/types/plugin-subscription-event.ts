import { Store } from "pinia"

export type StoreActionAfter = (actionName: string, store: Store) => void
export type StoreActionBefore = (actionName: string, store: Store) => void
export type StoreActionError = (actionName: string, store: Store, error: unknown) => void
