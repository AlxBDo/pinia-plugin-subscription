import { getStoreInstanceScopedKey } from "../utils/store"
import { STORE } from "../dictionaries/plugin-subscription-event"
import { traceGroups } from "../utils/traceGroups"

import type { StateTree, Store, SubscriptionCallbackMutation } from "pinia"
import type { StoreEventsGateway, TraceReporter } from "../types/core"
import type StoreSubscriptionsRegistry from "./StoreSubscriptionsRegistry"
import type TraceGroupHelper from "./TraceGroupHelper"

/** Hooks the stores `$onAction` / `$subscribe` and runs the registered callbacks inside trace groups. */
export default class StoreActionExecutor {
    private _events: StoreEventsGateway
    private _groups: TraceGroupHelper
    private _registry: StoreSubscriptionsRegistry
    private _reporter: TraceReporter

    constructor(
        registry: StoreSubscriptionsRegistry,
        groups: TraceGroupHelper,
        events: StoreEventsGateway,
        reporter: TraceReporter
    ) {
        this._registry = registry
        this._groups = groups
        this._events = events
        this._reporter = reporter
    }

    /** Subscribes once to the store `$subscribe` hook and dispatches mutations to the registered callbacks. */
    hookStoreMutations(store: Store): void {
        if (this._registry.hasMutationUnsubscribe(store)) {
            return
        }

        const unsubscribe = store.$subscribe(async (mutation: SubscriptionCallbackMutation<StateTree>) => {
            const callbacks = this._registry.getMutationSubscriptions(store)
            if (!callbacks?.size) {
                return
            }

            const groupId = traceGroups.onMutation(store.$id, this._groups.nextSeq())
            this._groups.start(() => ({ mutation, groupId }), store.$id, 'store:onMutation')
            this._events.emit(store, STORE.MUTATION, () => ({ mutation }))
            try {
                await Promise.all([...callbacks].map(async (mutationCallback) => {
                    try {
                        await mutationCallback(mutation)
                    } catch (error) {
                        this._reporter.traceError('store:onMutation', error, store.$id, () => ({ groupId }))
                    }
                }))
            } finally {
                this._groups.end(() => ({ groupId }), store.$id)
            }
        })

        this._registry.setMutationUnsubscribe(store, unsubscribe)
    }

    /**
     * Hooks the store `$onAction` once, when a callback, an event subscription or a deferred subscriber needs it.
     */
    executeStoreOnActionSubscription(store: Store, hasDeferredSubscribers = false): void {
        const { ACTION_BEFORE, ACTION_AFTER, ACTION_ERROR, ACTION_ON_ERROR } = STORE
        const storeHasEventSubscription = () => [ACTION_BEFORE, ACTION_AFTER, ACTION_ERROR, ACTION_ON_ERROR].some(
            eventName => this._events.hasEventSubscription(store, eventName)
        )
        if (
            this._registry.isOnActionHooked(store) || typeof store.$onAction !== 'function' || (
                !this._registry.getOnActionSubscriptions(store)?.size
                && !storeHasEventSubscription()
                && !hasDeferredSubscribers
            )) {
            return
        }

        this._registry.markOnActionHooked(store)
        store.$onAction(({ after, args, name, onError }) => {
            const invocationKey = storeHasEventSubscription() ? Symbol(getStoreInstanceScopedKey(name, store)) : undefined
            const callbacks = this._registry.getOnActionSubscriptions(store)
            if (!callbacks?.size && !invocationKey) {
                return
            }

            const storageKey = getStoreInstanceScopedKey(name, store)
            const callId = this._groups.nextSeq()
            const actionId = `${store.$id}#${callId}`
            const groupId = traceGroups.onAction(store.$id, name, callId)
            // The group must be closed exactly once, whichever way the action ends.
            let groupClosed = false
            const closeGroup = () => {
                if (callbacks?.size && !groupClosed) {
                    groupClosed = true
                    this._groups.end({ groupId }, store.$id)
                }
            }
            if (callbacks?.size) {
                this._groups.start(() => ({ actionId, args, groupId }), store.$id, `store:onAction:${name}`)
            }
            this._events.emit(store, STORE.ACTION_BEFORE, () => ({
                action: name, args, invocationKey
            }))


            try {
                // Callbacks are invoked synchronously so that their after/onError collectors are filled before Pinia runs the action.
                const pending: Promise<void>[] = []
                callbacks?.forEach(callback => {
                    const result = this._groups.runSafely(
                        () => callback({
                            after: (afterCallback) => this._registry.addOnActionAfterCallback(name, store, afterCallback),
                            args,
                            name,
                            onError: (errorCallback) => this._registry.addOnActionOnErrorCallback(name, store, errorCallback)
                        }),
                        'store:onAction:callback:error',
                        store.$id,
                        () => ({ actionId, groupId })
                    )
                    if (result) {
                        pending.push(result)
                    }
                })

                this._groups.endAfter(pending, closeGroup)
                this.executeStoreOnActionAfterCallbacks(after, storageKey, store, name, actionId, callId, invocationKey)
                this.executeStoreOnActionOnErrorCallbacks(onError, storageKey, store, name, actionId, callId, invocationKey)
                this._registry.clearOnActionCallbacks(storageKey)
            } catch (error) {
                this._events.emit(store, STORE.ACTION_ERROR, () => ({
                    action: name, error, invocationKey
                }))
                closeGroup()
                throw error
            }
        })
    }

    private executeStoreOnActionAfterCallbacks(
        after: (callback: (result: any) => void) => void,
        storageKey: string,
        store: Store,
        name: string,
        actionId: string,
        callId: number,
        invocationKey?: symbol
    ) {
        const afterCallbacks = this._registry.getOnActionAfterCallbacks(storageKey)
        if (afterCallbacks?.length || invocationKey) {
            after((result) => {
                if (invocationKey && !this._registry.isDisposed(store)) {
                    this._events.emit(store, STORE.ACTION_AFTER, () => ({
                        action: name, result, invocationKey
                    }))
                }
                if (!afterCallbacks?.length) {
                    return
                }
                this._groups.start(
                    () => ({
                        actionId,
                        groupId: traceGroups.onActionAfter(store.$id, name, callId),
                        result
                    }),
                    store.$id,
                    `store:onAction:after:${name}`
                )

                const pending = afterCallbacks.map(callback => this._groups.runSafely(
                    () => callback(result),
                    'storeOnActionAfterCallbacks',
                    store.$id,
                    () => ({ actionId, 'action name': name, groupId: traceGroups.onActionAfter(store.$id, name, callId) })
                ))

                this._groups.endAfter(pending, () =>
                    this._groups.end(() => ({ groupId: traceGroups.onActionAfter(store.$id, name, callId) }), store.$id))
            })
        }
    }

    private executeStoreOnActionOnErrorCallbacks(
        onError: (callback: (error: any) => void) => void,
        storageKey: string,
        store: Store,
        name: string,
        actionId: string,
        callId: number,
        invocationKey?: symbol
    ) {
        const onErrorCallbacks = this._registry.getOnActionOnErrorCallbacks(storageKey)

        if (onErrorCallbacks?.length || invocationKey) {
            onError((error) => {
                if (invocationKey && !this._registry.isDisposed(store)) {
                    this._events.emit(store, STORE.ACTION_ON_ERROR, () => ({
                        action: name, error, invocationKey
                    }))
                }
                if (!onErrorCallbacks?.length) {
                    return
                }
                this._groups.start(() => ({
                    actionId,
                    'action name': name,
                    error,
                    groupId: traceGroups.onActionError(store.$id, name, callId)
                }), store.$id,
                    `store:onAction:onError:${name}`
                )

                const pending = onErrorCallbacks.map(callback => this._groups.runSafely(
                    () => callback(error),
                    'store:onAction:onError:error',
                    store.$id,
                    () => ({ actionId, groupId: traceGroups.onActionError(store.$id, name, callId) })
                ))

                this._groups.endAfter(pending, () =>
                    this._groups.end(() => ({ groupId: traceGroups.onActionError(store.$id, name, callId) }), store.$id))
            })
        }
    }
}
