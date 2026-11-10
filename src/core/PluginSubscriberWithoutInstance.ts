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
    private _name: string
    private _pluginOptions?: StoreClassConstructorParams
    protected _storeOnActionSubscription?: StoreOnActionSubscription
    protected _storeMutationSubscription?: StoreMutationSubscription
    protected _subscriptions?: PluginSubscriptions
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
    public invoke({ store }: PiniaPluginContext, pluginOptions?: PluginOptions): boolean {
        this._tracer = pluginOptions?.createTracer ? pluginOptions.createTracer(this.name) : undefined
        if (this.pluginCreated) {
            this.pluginCreated(store)
        }

        return true
    }

    protected override traceLabelFormatter(label: string): string {
        return `${this.name}:${label}`
    }
}