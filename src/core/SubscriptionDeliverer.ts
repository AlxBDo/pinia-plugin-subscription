import { getStoreInstanceKeyPrefix, getStoreInstanceScopedKey } from "../utils/store"
import { isEmpty } from "../utils/validation"
import { traceGroups } from "../utils/traceGroups"

import type { PiniaPluginContext, Store } from "pinia"
import type { AnyObject } from "../types"
import type { TraceReporter } from "../types/core"
import type {
    PluginSubscriber,
    PluginSubscription as PluginSubscriptionDefinition,
    PluginSubscriptions
} from "../types/plugin"
import type ExecutionPolicy from "./ExecutionPolicy"
import type StoreSubscriptionsRegistry from "./StoreSubscriptionsRegistry"
import type TraceGroupHelper from "./TraceGroupHelper"

function clearKeysByPrefix(keys: Set<string>, prefix: string): void {
    for (const key of Array.from(keys)) {
        if (key.startsWith(prefix)) {
            keys.delete(key)
        }
    }
}

/** Delivers subscriptions to plugins and tracks which subscribers/subscriptions already ran or are scheduled. */
export default class SubscriptionDeliverer {
    private _groups: TraceGroupHelper
    private _policy: ExecutionPolicy
    private _registry: StoreSubscriptionsRegistry
    private _reporter: TraceReporter
    private _subscribersDelivered: Set<string> = new Set()
    private _subscribersScheduled: Set<string> = new Set()
    private _subscriptionsDelivered: Set<string> = new Set()
    private _subscriptionsScheduled: Set<string> = new Set()

    constructor(
        policy: ExecutionPolicy,
        registry: StoreSubscriptionsRegistry,
        groups: TraceGroupHelper,
        reporter: TraceReporter
    ) {
        this._policy = policy
        this._registry = registry
        this._groups = groups
        this._reporter = reporter
    }

    clearStore(store: Store): void {
        const keyPrefix = getStoreInstanceKeyPrefix(store)

        clearKeysByPrefix(this._subscribersDelivered, keyPrefix)
        clearKeysByPrefix(this._subscribersScheduled, keyPrefix)
        clearKeysByPrefix(this._subscriptionsDelivered, keyPrefix)
        clearKeysByPrefix(this._subscriptionsScheduled, keyPrefix)
    }

    defineSubscriberKey(subscriber: PluginSubscriber, store: Store): string {
        return getStoreInstanceScopedKey(subscriber.name, store)
    }

    defineSubscriptionKey(pluginName: string, store: Store): string {
        return getStoreInstanceScopedKey(pluginName, store)
    }

    isSubscriberDelivered(subscriberKey: string): boolean {
        return this._subscribersDelivered.has(subscriberKey)
    }

    /** A subscriber is handled once it ran or while its deferred run is scheduled. */
    isSubscriberHandled(subscriberKey: string): boolean {
        return this._subscribersDelivered.has(subscriberKey) || this._subscribersScheduled.has(subscriberKey)
    }

    markSubscriberDelivered(subscriberKey: string): void {
        this._subscribersDelivered.add(subscriberKey)
    }

    isSubscriptionScheduled(subscriptionKey: string): boolean {
        return this._subscriptionsScheduled.has(subscriptionKey)
    }

    /**
     * Schedules the subscriber execution once the store is hydrated.
     * The execution is wrapped in a trace group, kept open until async hydration hooks settle.
     */
    queueSubscriberExecution(
        context: PiniaPluginContext,
        subscriber: PluginSubscriber,
        subscriberKey: string,
        execute: (context: PiniaPluginContext, subscriber: PluginSubscriber) => Promise<unknown> | undefined
    ): void {
        const scheduler = this._policy.resolveHydrationScheduler(subscriber)

        this._subscribersScheduled.add(subscriberKey)
        scheduler(() => {
            if (this._registry.isDisposed(context.store)) {
                return
            }
            this._subscribersScheduled.delete(subscriberKey)

            // Deferred runs happen after plugin() closed its group: open one so their traces stay grouped by store
            const storeId = context.store.$id
            const groupId = traceGroups.pluginDeferred(storeId, subscriber.name, this._groups.nextSeq())
            this._groups.start(() => ({ groupId, subscriber: subscriber.name }), storeId, 'subscriber:deferred')
            const closeGroup = () => this._groups.end(() => ({ groupId }), storeId)
            let pending: Promise<unknown> | undefined
            try {
                pending = execute(context, subscriber)
            } finally {
                // Keep the group open until async hydration hooks settle, so their traces stay inside it
                if (pending) {
                    this._groups.closeWhenSettled(pending, closeGroup, storeId, subscriber.name)
                } else {
                    closeGroup()
                }
            }
        })
    }

    subscriptionDelivery(
        context: PiniaPluginContext,
        pluginSubscriptions: PluginSubscriptions
    ): void {
        Object.entries(pluginSubscriptions).forEach(([pluginName, pluginSubscription]) => {
            const subscriptionKey = this.defineSubscriptionKey(pluginName, context.store)
            const execution = this._policy.resolveExecution(pluginSubscription.subscription)

            if (
                this._subscriptionsDelivered.has(subscriptionKey)
                || this._subscriptionsScheduled.has(subscriptionKey)
            ) {
                return
            }

            if (!this._policy.shouldInvoke(execution)) {
                return
            }

            if (this._policy.shouldScheduleAfterHydration(execution)) {
                const scheduler = this._policy.resolveHydrationScheduler(pluginSubscription.subscription)

                this._subscriptionsScheduled.add(subscriptionKey)
                scheduler(() => {
                    if (this._registry.isDisposed(context.store)) {
                        return
                    }
                    this._subscriptionsScheduled.delete(subscriptionKey)
                    this.subscriptionDeliverySafely(context, pluginName, pluginSubscription)
                })
                return
            }

            this.subscriptionDeliverySafely(context, pluginName, pluginSubscription)
        })
    }

    subscriptionDeliverySafely(
        { store, options }: PiniaPluginContext,
        pluginName: string,
        pluginSubscription: PluginSubscriptionDefinition
    ): void {
        try {
            if (this._subscriptionsDelivered.has(this.defineSubscriptionKey(pluginName, store))) {
                return
            }

            const { subscription, subscriptionOptions, stores } = pluginSubscription

            this._reporter.trace('Subscription:delivery', store.$id, () => ({
                groupId: traceGroups.plugin(store.$id),
                pluginName,
                subscription,
                subscriptionOptions
            }))

            const pluginOptions = {
                storeOptions: { ...(options?.storeOptions ?? {}), ...subscriptionOptions }
            }

            subscription.invoke(
                { store, options: { ...options, ...pluginOptions } } as PiniaPluginContext
            )
            this._subscriptionsDelivered.add(this.defineSubscriptionKey(pluginName, store))

            if (!isEmpty(stores)) {
                stores?.forEach(
                    store => subscription.invoke({
                        store,
                        options: {
                            ...options,
                            ...pluginOptions,
                            ...((store as AnyObject)?.storeOptions ?? {})
                        }
                    } as PiniaPluginContext)
                )
            }
        } catch (e) {
            this._reporter.traceError('subscription:delivery', e, store.$id, () => ({ groupId: traceGroups.plugin(store.$id) }))
        }
    }
}
