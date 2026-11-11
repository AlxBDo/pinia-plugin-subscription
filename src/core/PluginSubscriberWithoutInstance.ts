import StoreEventsSubscriber from "../events/store-events-subscriber";
import StoreEventSubscriberHandler from "../events/store-events-subscriber-handler";
import TraceEmitterBase from "../system/TraceEmitterBase";
import type { PiniaPluginContext, Store as PiniaStore } from "pinia";
import type {
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginOptions,
    PluginSubscriber as PluginSubscriberInterface,
    PluginSubscriptions,
    StoreClassConstructorParams,
    StoreMutationSubscription,
    StoreOnActionSubscription
} from "../types/plugin";


/**
 * @param store The Pinia store for which the instance is being created.
 * @param options Additional options for creating the store instance.
 * @returns The created store instance or undefined if creation fails.
 */
export default abstract class PluginSubscriberWithoutInstance extends TraceEmitterBase implements PluginSubscriberInterface {
    private _eventsStoreSubscribers: Map<string, StoreEventsSubscriber> = new Map()
    /** Options for the plugin subscriber's execution. */
    public execution?: PluginExecutionOptions
    /** Scheduler for handling the hydration process of the plugin subscriber. */
    public hydrationScheduler?: PluginHydrationScheduler
    private _name: string
    /**
     * Called when the plugin subscriber has been created for a specific store.
     * This callback can be used to perform any initialization or setup required for the plugin subscriber.
     */
    protected pluginCreated?: (store: PiniaStore) => void
    private _pluginOptions?: StoreClassConstructorParams
    protected _storeEventSubscriberHandler?: StoreEventSubscriberHandler
    /**
     * Subscription for store actions.
     * This subscription is used to listen for actions dispatched in the store.
     */
    protected _storeOnActionSubscription?: StoreOnActionSubscription
    /**
     * Subscription for store mutations.
     * This subscription is used to listen for mutations occurring in the store.
     */
    protected _storeMutationSubscription?: StoreMutationSubscription
    /**
     * Subscriptions for the plugin subscriber.
     * This is used to manage and track all active subscriptions related to the plugin subscriber.
     */
    protected _subscriptions?: PluginSubscriptions


    get name(): string {
        return this._name;
    }

    get pluginOptions(): StoreClassConstructorParams | undefined {
        return this._pluginOptions;
    }

    set pluginOptions(options: StoreClassConstructorParams | undefined) {
        this._pluginOptions = options;
    }

    get storeOnActionSubscription(): StoreOnActionSubscription | undefined {
        return this._storeOnActionSubscription;
    }

    get storeMutationSubscription(): StoreMutationSubscription | undefined {
        return this._storeMutationSubscription;
    }

    get subscriptions(): PluginSubscriptions | undefined {
        return this._subscriptions
    }

    set subscriptions(subscriptions: PluginSubscriptions) {
        this._subscriptions = subscriptions
    }


    constructor(pluginName: string) {
        super()
        this._name = pluginName
    }

    protected addEventStoreSubscriber(subscriber: StoreEventsSubscriber) {
        if (!this._storeEventSubscriberHandler) {
            return
        }

        this._eventsStoreSubscribers.set(subscriber.id as string, subscriber)
        this._storeEventSubscriberHandler.subscribe(subscriber.storeId as string, subscriber)
        this.trace(
            `eventsStoreSubscriber:${subscriber.id}:subscribed`,
            subscriber.storeId,
            () => ({ eventsStoreSubscriber: subscriber })
        )
    }

    protected addEventStoreSubscription(
        id: string,
        store: PiniaPluginContext['store'],
        subscriptions: Record<string, (...args: any[]) => void>
    ) {
        this.addEventStoreSubscriber(new StoreEventsSubscriber(id, store, subscriptions))
    }

    /**
     * Called after the store has been hydrated.
     * @param context The Pinia plugin context containing the store and options.
     * @returns A promise that resolves when the post-hydration process is complete, or void if synchronous.
     */
    public afterHydration(_context: PiniaPluginContext): void | Promise<void> {
        return
    }

    public clearStoreEventsSubscriptions(storeId: string) {
        this._eventsStoreSubscribers.delete(storeId)
        this._storeEventSubscriberHandler?.clearSubscribers(storeId)
    }

    /**
     * Called when the plugin subscriber needs to hydrate its state.
     * @param context The Pinia plugin context containing the store and options.
     * @returns A promise that resolves when the hydration process is complete, or void if synchronous.
     */
    public hydrate(_context: PiniaPluginContext): void | Promise<void> {
        return
    }

    /**
     * Invokes the plugin subscriber with the given context and optional plugin options.
     * @param context The Pinia plugin context containing the store and options.
     * @param pluginOptions Optional tracer factory and events handler.
     * @returns True if the plugin was successfully invoked, otherwise false.
     */
    public invoke({ store }: PiniaPluginContext, pluginOptions?: PluginOptions): boolean {
        this._tracer = pluginOptions?.createTracer ? pluginOptions.createTracer(this.name) : undefined
        this._storeEventSubscriberHandler = pluginOptions?.eventsHandler
        if (this.pluginCreated) {
            this.pluginCreated(store)
        }

        return true
    }

    protected override traceLabelFormatter(label: string): string {
        return `${this.name}:${label}`
    }
}