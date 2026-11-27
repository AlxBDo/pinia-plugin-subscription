import { PluginEventsSubscriber } from "../core/Plugin"
import Store from "./Store";
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
import type { Tracer } from "../types/trace";


type CreateInstance<Instance = Store> = (store: PiniaStore, options: StoreClassConstructorParams) => Instance | undefined


/**
 * Type definition for the function used to create an instance of a store.
 * @template Instance The type of the store instance, defaulting to the base Store class.
 * @param store The Pinia store for which the instance is being created.
 * @param options Additional options for creating the store instance.
 * @returns The created store instance or undefined if creation fails.
 */
export default abstract class PluginSubscriber<Instance extends Store> extends PluginEventsSubscriber implements PluginSubscriberInterface {
    private _createInstance: CreateInstance<Instance>
    /** Options for the plugin subscriber's execution. */
    public execution?: PluginExecutionOptions
    /** Scheduler for handling the hydration process of the plugin subscriber. */
    public hydrationScheduler?: PluginHydrationScheduler
    /**
     * Called when the plugin subscriber has been created for a specific store.
     * This callback can be used to perform any initialization or setup required for the plugin subscriber.
     */
    protected pluginCreated?: (store: PiniaStore) => void
    private _pluginOptions?: StoreClassConstructorParams
    private _storeInstances = new WeakMap<PiniaStore, Instance>()
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


    get pluginOptions(): StoreClassConstructorParams | undefined {
        return this._pluginOptions;
    }

    set pluginOptions(options: StoreClassConstructorParams | undefined) {
        this._pluginOptions = options;
    }

    /**
     * Returns the wrapper created for a specific Pinia store.
     * @param store The Pinia store passed to the subscriber hook.
     */
    getStoreInstance(store: PiniaStore): Instance | undefined {
        return this._storeInstances.get(store)
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


    constructor(createInstanceFunction: CreateInstance<Instance>) {
        super({ prefixLabelWithName: true })
        this._createInstance = createInstanceFunction
    }

    /**
     * Called after the store has been hydrated.
     * @param context The Pinia plugin context containing the store and options.
     * @returns A promise that resolves when the post-hydration process is complete, or void if synchronous.
     */
    public afterHydration(_context: PiniaPluginContext): void | Promise<void> {
        return
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
    public invoke({ store, options }: PiniaPluginContext, pluginOptions?: PluginOptions): boolean {
        this._tracer = pluginOptions?.createTracer ? pluginOptions.createTracer(this.name) : undefined
        this._eventsRegistry = pluginOptions?.eventsRegistry
        const instance = this._createInstance(store, {
            ...options,
            ...this.pluginOptions,
            createTracer: this._tracer ? (() => (this._tracer as Tracer)) : undefined,
            eventsRegistry: this._eventsRegistry
        })

        if (!instance) {
            this._storeInstances.delete(store)
            return false
        }

        this._storeInstances.set(store, instance)
        this._subscriptions = instance.getSubscriptions()
        this._storeMutationSubscription = instance.storeSubscribe
        this._storeOnActionSubscription = instance.onAction

        if (this.pluginCreated) {
            this.pluginCreated(store)
        }

        return true
    }
}