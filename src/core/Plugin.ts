import Event from '../events/event'
import EventSubscription from '../events/events-subscription'
import { STORE } from '../dictionaries/plugin-subscription-event'
import StoreEvent from '../events/store-event'
import { getStoreInstanceId } from '../utils/store'

import type { PiniaPluginContext, Store } from "pinia"
import type EventSubscriber from '../events/events-subscriber'
import type { TracePayload, Tracer } from '../types/trace'
import type { MessengerEmitter } from '../types/messenger'
import type { EventRegistry, EventsSubscriberFactory, StoreEventConstructorOptions } from '../types/events'


const storesOnDisposeCallbacks: WeakMap<Store, ((store: Store) => void)[]> = new WeakMap()
const hasEventsSubscriber: Set<string> = new Set()
const storeHasEventsSubscriber: WeakSet<Store> = new WeakSet()

/**
 * Abstract class for Plugin implementations.
 */
export abstract class PluginEvent {
    protected abstract _name: string
    protected _eventsRegistry?: EventRegistry
    protected traceOptions = { prefixLabelWithName: false }
    /**
     * Tracer for structured logging and debugging.
     */
    protected _tracer?: Tracer


    get name(): string {
        return this._name
    }

    /** Returns the structured trace emitter, if tracing is enabled. */
    get tracer(): Tracer | undefined {
        return this._tracer
    }

    /**
     * Initializes the store events emitter with the given name and trace options.
     * @param name The name of the emitter.
     * @param prefixLabelWithName Whether to prefix trace labels with the emitter name.
     */
    constructor({ prefixLabelWithName }: { prefixLabelWithName?: boolean } = { prefixLabelWithName: false }) {
        this.traceOptions.prefixLabelWithName = prefixLabelWithName ?? false
    }


    /**
     * Emits an event to all subscribers of the given store.
     * @param store The store instance to emit the event for.
     * @param event The name of the event to emit.
     * @param payload Optional payload factory function for the event.
     */
    protected emit(store: Store, event: string, payload?: () => any): void {
        if (!this.storeHasEventSubscription(store, event)) {
            return
        }

        this._eventsRegistry?.emitter?.emit(new StoreEvent(event, {
            payload,
            source: this.name,
            scope: store.$id,
            instanceId: getStoreInstanceId(store)
        }))
    }

    protected storeHasEventsSubscriber(store: Store): boolean {
        return storeHasEventsSubscriber.has(store)
    }

    protected storeHasEventSubscription(store: Store, eventName: string): boolean {
        return this._eventsRegistry?.subscriptionsRegistry.has(store, eventName) ?? false
    }

    /**
     * Emits a structured trace event.
     * Prefer the factory form for `payload`: it is only resolved when consumed.
     * @param label The label for the trace event.
     * @param scope Optional scope for the trace event.
     * @param payload Optional payload for the trace event.
     * @param namespace Optional namespace for the trace event.
     */
    protected trace(label: string, scope?: string, payload?: TracePayload, namespace?: string): void {
        if (this.tracer) {
            label = this.traceLabelFormatter(label)
            this.tracer.debug(label, namespace ?? label.toLowerCase(), payload, scope)
        }
    }

    /**
     * Emits a structured error event, or reports it with `console.error` when tracing is disabled.
     * @param label The label for the error event.
     * @param error The error object.
     * @param scope Optional scope for the error event.
     * @param payload Optional payload for the error event.
     * @param namespace Optional namespace for the error event.
     */
    protected traceError(label: string, error: unknown, scope?: string, payload?: TracePayload, namespace?: string): void {
        if (this.tracer) {
            label = this.traceLabelFormatter(label)
            this.tracer.error(label, namespace ?? label.toLowerCase(), error, payload, scope)
        } else {
            console.error(error)
        }
    }

    /**
     * Formats the trace label according to the trace options.
     * @param label The original trace label.
     * @returns The formatted trace label.
     */
    protected traceLabelFormatter(label: string): string {
        if (this.traceOptions.prefixLabelWithName) {
            label = `${this._name}:${label}`
        }
        return label
    }
}

export abstract class PluginEventsSubscriber extends PluginEvent {
    protected _eventsSubscriber: EventSubscriber | undefined

    /**
     * Initializes the event subscriber with the given ID and optional event subscriptions.
     * @param id The identifier for the event subscriber.
     * @param eventSubscriptions Optional array of event subscriptions to initialize the subscriber with.
     * @returns void
     */
    protected initEventsSubscriber(
        id: string,
        eventSubscriptions?: EventSubscription[]
    ): void {
        const subscriber = this._eventsRegistry?.createSubscriber(id, eventSubscriptions)
        if (!subscriber) {
            return
        }
        this._eventsSubscriber = subscriber
    }

    /**
     * Adds a subscription for store events.
     * @param eventName The name of the event to subscribe to.
     * @param consumer The consumer function to handle the event.
     * @param options Optional event options.
     */
    protected addEventSubscription(
        eventName: string,
        consumer: (...args: any[]) => void | Promise<void>,
        options?: StoreEventConstructorOptions,
    ): void {
        if (!this._eventsSubscriber) {
            this.initEventsSubscriber(options?.scope ?? this._name, [new EventSubscription(eventName, consumer, options)])
            return
        }

        this._eventsSubscriber.addSubscription(eventName, consumer, options)
    }
}

export abstract class PluginStoreEventSubscriber extends PluginEventsSubscriber {
    protected abstract _store: Store

    protected override addEventSubscription(
        eventName: string,
        consumer: (...args: any[]) => void | Promise<void>,
        options?: StoreEventConstructorOptions,
    ): void {
        this._eventsRegistry?.subscriptionsRegistry.add(this._store, eventName)
        super.addEventSubscription(eventName, consumer, {
            ...(options ?? {}),
            scope: options?.scope ?? this._store.$id,
            instanceId: getStoreInstanceId(this._store)
        })
    }

    protected override initEventsSubscriber(
        id: string,
        eventSubscriptions?: EventSubscription[]
    ): void {
        eventSubscriptions?.forEach(sub => {
            if (!sub.scope) {
                sub.instanceId = getStoreInstanceId(this._store)
            }
            this._eventsRegistry?.subscriptionsRegistry.add(this._store, sub.name)
        })

        super.initEventsSubscriber(id, eventSubscriptions)
        storeHasEventsSubscriber.add(this._store)
        this.onDispose(() => {
            this._eventsSubscriber?.unsubscribe()
            storeHasEventsSubscriber.delete(this._store)
            this._eventsRegistry?.subscriptionsRegistry.clear(this._store)
        })
    }

    /**
     * Registers a callback to be invoked when the specified store is disposed.
     * @param store The store to watch for disposal.
     * @param callback The callback to invoke on store disposal.
     */
    protected onDispose(callback: (store: Store) => void) {
        if (!storesOnDisposeCallbacks.has(this._store)) {
            storesOnDisposeCallbacks.set(this._store, [])
        }
        storesOnDisposeCallbacks.get(this._store)?.push(callback)
    }

    protected onStoreDispose() {
        const callbacks = storesOnDisposeCallbacks.get(this._store)
        if (!callbacks || callbacks.length === 0) {
            return
        }

        this.addEventSubscription(
            STORE.DISPOSE,
            () => {
                callbacks?.forEach(callback => {
                    try {
                        callback?.(this._store)
                    } catch (error) {
                        this.traceError("store:dispose:callback:error", error, this._store.$id)
                    }
                })
            },
            { scope: this._store.$id }
        )
    }
}