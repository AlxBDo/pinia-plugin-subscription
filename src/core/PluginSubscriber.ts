import PluginSubscriberWithoutInstance from "./PluginSubscriberWithoutInstance";
import Store from "./Store";
import type { PiniaPluginContext, Store as PiniaStore } from "pinia";
import type { PluginOptions, StoreClassConstructorParams } from "../types/plugin";
import type { Tracer } from "../types/trace";


type CreateInstance<Instance = Store> = (store: PiniaStore, options: StoreClassConstructorParams) => Instance | undefined


/**
 * Type definition for the function used to create an instance of a store.
 * @template Instance The type of the store instance, defaulting to the base Store class.
 * @param store The Pinia store for which the instance is being created.
 * @param options Additional options for creating the store instance.
 * @returns The created store instance or undefined if creation fails.
 */
export default abstract class PluginSubscriber<Instance extends Store> extends PluginSubscriberWithoutInstance {
    private _createInstance: CreateInstance
    private _storeInstance?: Instance

    get storeInstance(): Instance | undefined {
        return this._storeInstance
    }


    constructor(pluginName: string, createInstanceFunction: CreateInstance) {
        super(pluginName)
        this._createInstance = createInstanceFunction
    }

    /**
     * Invokes the plugin subscriber with the given context and optional plugin options.
     * @param context The Pinia plugin context containing the store and options.
     * @param pluginOptions Optional tracer factory and events handler.
     * @returns True if the plugin was successfully invoked, otherwise false.
     */
    public override invoke({ store, options }: PiniaPluginContext, pluginOptions?: PluginOptions): boolean {
        super.invoke({ store } as PiniaPluginContext, pluginOptions)
        this._storeInstance = this._createInstance(store, {
            ...options,
            ...this.pluginOptions,
            createTracer: this._tracer ? (() => (this._tracer as Tracer)) : undefined
        }) as Instance

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