import Store from "./Store";
import type { PiniaPluginContext, Store as PiniaStore } from "pinia";
import type { AnyObject } from "../types";
import type {
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginSubscriber as PluginSubscriberInterface,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreOnActionSubscription
} from "../types/plugin";
import type Tracer from "../system/Tracer";



type CreateInstance<Instance = Store> = (store: PiniaStore, options: AnyObject) => Instance | undefined


/**
 * Type definition for the function used to create an instance of a store.
 * @template Instance The type of the store instance, defaulting to the base Store class.
 * @param store The Pinia store for which the instance is being created.
 * @param options Additional options for creating the store instance.
 * @returns The created store instance or undefined if creation fails.
 */
export default abstract class PluginSubscriber<Instance extends Store> implements PluginSubscriberInterface {
    private _createInstance: CreateInstance
    private _name: string
    private _pluginOptions?: AnyObject
    private _storeInstance?: Instance
    /** Callback function to reset the store instance, if needed. */
    protected _resetStoreCallback?: (store?: PiniaStore) => void
    private _storeOnActionSubscription?: StoreOnActionSubscription
    private _storeMutationSubscription?: StoreMutationSubscription
    private _subscriptions?: PluginSubscriptions
    /**
     * Called when the plugin subscriber has been created for a specific store.
     * This callback can be used to perform any initialization or setup required for the plugin subscriber.
     */
    protected pluginCreated?: (store: PiniaStore) => void
    /** Options for the plugin subscriber's execution. */
    public execution?: PluginExecutionOptions
    /** Scheduler for handling the hydration process of the plugin subscriber. */
    public hydrationScheduler?: PluginHydrationScheduler


    get name(): string {
        return this._name;
    }

    get storeInstance(): Instance | undefined {
        return this._storeInstance
    }

    get pluginOptions(): AnyObject {
        return this._pluginOptions ?? {};
    }

    set pluginOptions(options: AnyObject | undefined) {
        this._pluginOptions = options;
    }

    get resetStoreCallback(): ((store?: PiniaStore) => void) | undefined {
        return this._resetStoreCallback as ((store?: PiniaStore) => void) | undefined;
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


    constructor(pluginName: string, createInstanceFunction: CreateInstance) {
        this._name = pluginName
        this._createInstance = createInstanceFunction
    }

    /**
     * Called after the store has been hydrated.
     * @param context The Pinia plugin context containing the store and options.
     * @returns A promise that resolves when the post-hydration process is complete, or void if synchronous.
     */
    public afterHydration(context: PiniaPluginContext): void | Promise<void> {
        return
    }

    /**
     * Called when the plugin subscriber needs to hydrate its state.
     * @param context The Pinia plugin context containing the store and options.
     * @returns A promise that resolves when the hydration process is complete, or void if synchronous.
     */
    public hydrate(context: PiniaPluginContext): void | Promise<void> {
        return
    }

    /**
     * Invokes the plugin subscriber with the given context and optional tracer creation function.
     * @param context The Pinia plugin context containing the store and options.
     * @param createTracer Optional function to create a tracer for the plugin.
     * @returns True if the plugin was successfully invoked, otherwise false.
     */
    public invoke({ store, options }: PiniaPluginContext, createTracer?: (name: string) => Tracer): boolean {
        this._storeInstance = this._createInstance(store, { ...options, ...this.pluginOptions, createTracer }) as Instance

        if (!this._storeInstance) {
            return false
        }

        this._subscriptions = this._storeInstance.getSubscriptions()
        this._storeMutationSubscription = this._storeInstance.storeSubscribe
        this._storeOnActionSubscription = this._storeInstance.onAction

        if (this.pluginCreated) {
            this.pluginCreated(store)
        }

        return true
    }
}