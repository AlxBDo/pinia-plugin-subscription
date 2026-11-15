import StoreEventsSubscriberHandler from "./store-events-subscriber-handler"
import type { TracePayload, Tracer } from '../types/trace'

import type { Store } from "pinia"

/**
 * Abstract class for emitting store events.
 * Provides methods to manage subscribers and emit events to them.
 */
export default abstract class EventsEmitter {
    protected abstract _name: string
    protected traceOptions = { prefixLabelWithName: false }
    /**
     * Handler for managing store events subscribers.
     * Provides methods to clear, emit, and query subscribers for store events.
     */
    protected _storeEventsSubscribersHandler?: StoreEventsSubscriberHandler
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
     * Clears all subscribers for the given store ID.
     * @param storeId The ID of the store to clear subscribers for.
     */
    protected clearSubscribers(storeId: string): void {
        this._storeEventsSubscribersHandler?.clearSubscribers(storeId)
    }

    /**
     * Emits an event to all subscribers of the given store.
     * @param store The store instance to emit the event for.
     * @param event The name of the event to emit.
     * @param payload Optional payload factory function for the event.
     */
    protected emit(store: Store, event: string, payload?: () => any): void {
        if (!this.hasSubscribers(store.$id)) {
            return
        }

        this._storeEventsSubscribersHandler?.emit(store, event, payload)
    }

    /**
     * Checks if there are any subscribers for the given store ID.
     */
    protected hasSubscribers(storeId: string): boolean {
        return (this._storeEventsSubscribersHandler?.getSubscribers(storeId).length ?? 0) > 0
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