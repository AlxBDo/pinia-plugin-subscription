import { PluginEvent } from "./Plugin"
import { PLUGIN, STORE, SUBSCRIBER } from "../dictionaries/plugin-subscription-event"
import { isEmpty } from "../utils/validation"
import { pluginName } from "../utils/constants"
import { createEventsRegistry } from "../factories/events-registry"
import { traceGroups } from "../utils/traceGroups"
import ExecutionPolicy from "./ExecutionPolicy"
import StoreActionExecutor from "./StoreActionExecutor"
import StoreSubscriptionsRegistry from "./StoreSubscriptionsRegistry"
import SubscriptionDeliverer from "./SubscriptionDeliverer"
import TraceGroupHelper from "./TraceGroupHelper"

import type { PiniaPluginContext, Store } from "pinia"
import type {
    PluginSubscriber,
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreMutationSubscription
} from "../types/plugin"

/**
 * Sequences the subscribers of a store: for each one, consults the execution policy, schedules or runs it,
 * then delegates the subscriptions bookkeeping, delivery and action/mutation hooks to dedicated collaborators.
 */
export default class PluginSubscription extends PluginEvent {
    protected _eventsRegistry = createEventsRegistry()
    protected _name: string = 'PluginSubscription'
    private _actionExecutor: StoreActionExecutor
    private _deliverer: SubscriptionDeliverer
    private _groups: TraceGroupHelper
    private _options?: PluginSubscriptionOptions
    private _policy: ExecutionPolicy
    private _registry: StoreSubscriptionsRegistry
    private _subscribers: PluginSubscriber[] = []
    private _subscriptions: PluginSubscriptions[] = []

    set subscribers(subscribers: PluginSubscriber[]) {
        this._subscribers = subscribers
    }

    get subscriptions(): PluginSubscriptions[] | undefined {
        if (!isEmpty(this._subscriptions)) {
            return this._subscriptions
        }
    }

    constructor(
        subscribers: PluginSubscriber[],
        options?: PluginSubscriptionOptions
    ) {
        super({ prefixLabelWithName: true })
        this._options = options
        this._subscribers = subscribers.sort((a, b) => {
            if (typeof a?.execution === 'undefined') {
                a.execution = { order: 9 }
            } else if (a.execution && typeof a.execution?.order === 'undefined') {
                a.execution.order = 9
            }
            if (typeof b?.execution === 'undefined') {
                b.execution = { order: 9 }
            } else if (b.execution && typeof b.execution?.order === 'undefined') {
                b.execution.order = 9
            }

            return (a.execution.order ?? 0) - (b.execution?.order ?? 0)
        })

        const reporter = {
            trace: (...args: Parameters<PluginEvent['trace']>) => this.trace(...args),
            traceError: (...args: Parameters<PluginEvent['traceError']>) => this.traceError(...args)
        }
        this._policy = new ExecutionPolicy(options)
        this._registry = new StoreSubscriptionsRegistry()
        this._groups = new TraceGroupHelper(options, reporter)
        this._deliverer = new SubscriptionDeliverer(this._policy, this._registry, this._groups, reporter)
        this._actionExecutor = new StoreActionExecutor(
            this._registry,
            this._groups,
            {
                emit: (store, event, payload) => this.emit(store, event, payload),
                hasEventSubscription: (store, eventName) => this.storeHasEventSubscription(store, eventName)
            },
            reporter
        )
        this.initializeTracer()
    }

    /** @returns A promise settling once asynchronous hydration hooks are done, undefined when everything ran synchronously. */
    private executeSubscriber(context: PiniaPluginContext, subscriber: PluginSubscriber): Promise<unknown> | undefined {
        const subscriberKey = this._deliverer.defineSubscriberKey(subscriber, context.store)

        if (this._deliverer.isSubscriberDelivered(subscriberKey)) {
            return
        }

        if (
            !subscriber.invoke(context, {
                createTracer: this._options?.tracerHandler?.createTracer,
                eventsRegistry: this._eventsRegistry
            })) {
            return
        }
        this.emit(context.store, SUBSCRIBER.INVOKED, () => ({ subscriber: subscriber.name }))
        this._deliverer.markSubscriberDelivered(subscriberKey)
        let hydrateResult: void | Promise<void>

        try {
            hydrateResult = subscriber.hydrate?.(context)
        } catch (error) {
            this.traceError('subscriber:hydrate', error, context.store.$id)
            return
        }

        const runAfterHydration = (): Promise<unknown> | undefined => {
            try {
                const afterHydration = subscriber.afterHydration?.(context)
                if (afterHydration && typeof (afterHydration as Promise<void>).then === 'function') {
                    return (afterHydration as Promise<void>).catch(
                        error => this.traceError('subscriber:afterHydration', error, context.store.$id)
                    )
                }
            } catch (error) {
                this.traceError('subscriber:afterHydration', error, context.store.$id)
            }
        }

        let pending: Promise<unknown> | undefined

        if (hydrateResult && typeof (hydrateResult as Promise<void>).then === 'function') {
            pending = (hydrateResult as Promise<void>)
                .then(() => runAfterHydration())
                .catch(error => this.traceError('subscriber:hydrate', error, context.store.$id))
        } else {
            pending = runAfterHydration()
        }

        if (subscriber.subscriptions) {
            this._deliverer.subscriptionDelivery(context, subscriber.subscriptions)
        }

        if (subscriber.storeMutationSubscription) {
            this.registerMutationSubscription(subscriber, subscriber.storeMutationSubscription)
        }

        this.registerOnActionSubscription(subscriber, context)

        return pending
    }

    private executeSubscriberSafely(context: PiniaPluginContext, subscriber: PluginSubscriber): Promise<unknown> | undefined {
        try {
            return this.executeSubscriber(context, subscriber)
        } catch (e) {
            this.traceError('subscriber:execute', e, context.store.$id, () => ({
                subscriber: subscriber.name,
            }))
        }
    }

    private initializeTracer() {
        if (this._options?.tracerHandler) {
            this._tracer = this._options.tracerHandler.createTracer(pluginName)
        }
    }

    /**
     * Invokes the plugin with the given Pinia plugin context, executing all relevant subscribers safely.
     * @param param0 The Pinia plugin context containing the store and options.
     * @param param0.store The Pinia store instance.
     * @param param0.options The options passed to the Pinia store.
     * @returns void
     */
    plugin({ store, options }: PiniaPluginContext) {
        if (!this._subscribers.length) {
            return
        }

        const subscribtions = {
            $onAction: [],
            $subscribe: [],
        }
        const pluginGroupId = traceGroups.plugin(store.$id)
        // The context is traced once subscribers ran: they may extend the store (e.g. parentsStores), and a redacted payload is a copy
        const contextPayload = () => ({
            groupId: pluginGroupId,
            subscribers: this._subscribers.map(subscriber => ({
                name: subscriber.name,
                execution: subscriber.execution,
                pluginOptions: subscriber.pluginOptions
            })),
            'hooks subscriptions': subscribtions,
            store,
            options
        })
        this._groups.start(() => ({ groupId: pluginGroupId }), store.$id, undefined, false)
        this.emit(store, PLUGIN.EXECUTION.START)

        this._registry.setTraces(store, { onAction: subscribtions.$onAction, onMutation: subscribtions.$subscribe })

        try {
            let hasDeferredSubscribers = false
            this._subscribers.forEach(
                subscriber => {
                    const subscriberKey = this._deliverer.defineSubscriberKey(subscriber, store)
                    const execution = this._policy.resolveExecution(subscriber)

                    if (this._deliverer.isSubscriberHandled(subscriberKey)) {
                        return
                    }

                    if (!this._policy.shouldInvoke(execution)) {
                        return
                    }

                    if (this._policy.shouldScheduleAfterHydration(execution)) {
                        hasDeferredSubscribers = true
                        this._deliverer.queueSubscriberExecution(
                            { store, options } as PiniaPluginContext,
                            subscriber,
                            subscriberKey,
                            (context, scheduled) => this.executeSubscriberSafely(context, scheduled)
                        )
                        return
                    }

                    this.executeSubscriber({ store, options } as PiniaPluginContext, subscriber)
                }
            )

            this._actionExecutor.executeStoreOnActionSubscription(store, hasDeferredSubscribers)
            this.registerStoreCleanup(store)
        } catch (error) {
            this.traceError('plugin:invoke', error, store.$id)
            this.emit(store, PLUGIN.EXECUTION.ERROR, () => ({ error }))
        }
        this.trace('context', store.$id, contextPayload)
        this._groups.end(() => ({ groupId: pluginGroupId }), store.$id)
        this.emit(store, PLUGIN.EXECUTION.END)
    }

    private registerMutationSubscription(subscriber: PluginSubscriber, subscription: StoreMutationSubscription): void {
        const { store, callback } = subscription()

        if (!store || !callback) {
            return
        }

        this._registry.addMutationSubscription(store, callback, subscriber.name)
        this._actionExecutor.hookStoreMutations(store)
    }

    private registerOnActionSubscription(subscriber: PluginSubscriber, context: PiniaPluginContext): void {
        const { store, callback } = subscriber?.storeOnActionSubscription?.(context) ?? {}

        if (!store || !callback) {
            return
        }

        this._registry.addOnActionSubscription(store, callback, subscriber.name)
    }

    private registerStoreCleanup(store: Store): void {
        this._registry.registerStoreCleanup(store, {
            onDispose: () => {
                this._deliverer.clearStore(store)
                this.emit(store, STORE.DISPOSE)
            },
            onError: error => this.traceError("store:dispose:error", error, store.$id)
        })
    }
}
