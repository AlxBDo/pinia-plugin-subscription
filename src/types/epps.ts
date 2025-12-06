import { StateTree, Store, SubscriptionCallbackMutationPatchFunction, SubscriptionCallbackMutationPatchObject } from "pinia"
import { AnyObject, DefineEppsStore, EppsStore } from "."
import ParentStoreClass from "../plugins/parentStore"



interface ActionFlow {
    after?: Function | string
    before?: Function | string
}

export type ActionFlows = Record<string, ActionFlow>

export interface ParentStoreInterface {
    get id(): string
    build: (childId: string) => EppsStore<AnyObject, AnyObject>
}


export type MutationCallback = (
    mutation: SubscriptionCallbackMutationPatchFunction | SubscriptionCallbackMutationPatchObject<StateTree>
) => void

export type ParentStore = (
    <TStore = AnyObject, TState = AnyObject>(id: string) => (DefineEppsStore<TStore, TState> | Store)
)

export type ParentStoreConstructor = (() => DefineEppsStore<AnyObject, AnyObject> | Store) | ParentStoreClass