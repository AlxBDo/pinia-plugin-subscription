import { isRef, ref, toRef, type Ref } from "vue"
import Tracer from "../system/Tracer"
import { getDefineAStoreSetupContext, hasDeniedFirstChar, setEnhancedStore } from "../utils/store"
import { isEmpty } from "../utils/validation"

import type {
    PluginSubscriptionOptions,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreMutationSubscriptionCallback,
    StoreMutationSubscriptionReturn,
    StoreOnActionSubscription,
    StoreOnActionSubscriptionCallback,
    StoreOnActionSubscriptionReturn
} from "../types/plugin"
import type { Store as PiniaStore, StateTree } from "pinia"
import type { TracePayload } from "../types/trace"
import type { AnyObject, PluginSubscriberInterface } from "../types"
import type { StoreOptions, StatePropertyValue, PluginStoreOptions } from "../types/store"

/**
 * Base class for a Pinia store with enhanced capabilities.
 * Provides structured tracing, plugin subscriptions, and state management utilities.
 */
export default class Store {
    protected _className = 'Store'
    private _onAction?: StoreOnActionSubscriptionCallback
    private _options: StoreOptions
    private _store: PiniaStore
    private _subscriptions: PluginSubscriptions = {}
    private _storeSubscribe?: StoreMutationSubscriptionCallback
    private _tracer?: Tracer
    private _createTracer?: PluginSubscriptionOptions['createTracer']

    protected static _requiredKeys?: string[]

    get onAction(): StoreOnActionSubscription | undefined {
        if (!this._onAction) {
            return
        }

        return () => ({
            store: this.store as PiniaStore,
            callback: this._onAction
        }) as StoreOnActionSubscriptionReturn
    }

    set onAction(onAction: StoreOnActionSubscriptionCallback) {
        this._onAction = onAction
    }

    get options(): StoreOptions { return this._options }

    get state(): StateTree { return this._store.$state }

    set state(state: StateTree) { this._store.$state = state }

    get store(): AnyObject { return this._store }

    get storeSubscribe(): StoreMutationSubscription | undefined {
        if (!this._storeSubscribe) {
            return
        }

        return () => ({
            store: this.store as PiniaStore,
            callback: this._storeSubscribe
        }) as StoreMutationSubscriptionReturn
    }

    set storeSubscribe(storeSubscribe: StoreMutationSubscriptionCallback) {
        this._storeSubscribe = storeSubscribe
    }

    /**
     * Returns the structured trace emitter of this store.
     * Built lazily so that subclasses overriding `_className` are reflected.
     */
    protected get tracer(): Tracer | undefined {
        if (!this._tracer && this._createTracer) {
            this._tracer = this._createTracer(this._className)
            this._tracer.scope = this.store.$id
        }

        return this._tracer
    }

    constructor(store: PiniaStore, options: PluginStoreOptions & PluginSubscriptionOptions) {
        this._options = options.storeOptions
        this._store = store
        this.initializeTracer(options)

        if (this._options?.enhancedStore) {
            const ctx = getDefineAStoreSetupContext(this.store)

            if (ctx) {
                setEnhancedStore(ctx, this.store)
            }
        }
    }

    /**
     * Adds a property to the state of this store.
     * @param name The name of the property to add.
     * @param value The value of the property to add.
     */
    addToState(name: string, value?: StatePropertyValue): void {
        if (!this.isOptionApi()) {
            if (!isRef(value)) {
                value = ref<StatePropertyValue>(value)
            }
        }

        this.state[name] = value
        this.store[name] = toRef(this.state, name)
    }

    /**
     * Adds a subscription for a specific plugin to this store.
     * @param pluginName The name of the plugin for which the subscription is being added.
     * @param subscription The subscription callback or object to add.
     * @param options Additional options for the subscription, including subscription options and target stores.
     */
    addSubscription(
        pluginName: string,
        subscription: PluginSubscriberInterface,
        options?: { subscriptionOptions?: StoreOptions, stores?: PiniaStore[] }
    ): void {
        this._subscriptions[pluginName] = { subscription, ...(options ?? {}) }
    }

    /**
     * Called after the store has been hydrated.
     * @returns A promise that resolves when the post-hydration process is complete, or void if synchronous.
     */
    afterHydration(): void | Promise<void> {
        return
    }

    /**
     * Create and return a class instance
     * @param store 
     * @param options 
     * @returns 
     */
    static customizeStore<Instance extends Store>(
        store: PiniaStore,
        options: PluginStoreOptions & PluginSubscriptionOptions
    ): Instance | undefined {
        if (options.storeOptions && this.hasRequiredKeys(options.storeOptions)) {
            return new this(store, options) as Instance
        }
    }

    /**
     * Retrieves the value of a specific store option.
     * @param optionName The name of the store option to retrieve.
     * @returns The value of the specified store option, or undefined if not found.
     */
    getOption(optionName: keyof StoreOptions) {
        return this.options && (this.options as StoreOptions)[optionName]
    }

    /**
     * Retrieves the value of a specific state property.
     * @param propertyName The name of the state property to retrieve.
     * @returns The value of the specified state property, or undefined if not found.
     */
    getStatePropertyValue(propertyName: string) {
        return this.getValue(this.state[propertyName])
    }

    /**
     * Retrieves all plugin subscriptions for this store.
     * @returns An object containing all plugin subscriptions, or undefined if there are none.
     */
    getSubscriptions(): PluginSubscriptions | undefined {
        if (isEmpty(this._subscriptions)) {
            return
        }

        return this._subscriptions
    }

    /**
     * Retrieves the actual value from a potentially reactive reference.
     * @param value The value to unwrap.
     * @returns The unwrapped value if it is a reactive reference, otherwise the original value.
     */
    getValue(value: any) {
        return value?.__v_isRef ? value.value : value
    }

    /**
     * Checks if the given property name has a denied first character.
     * @param property The property name to check.
     * @returns True if the property name has a denied first character, otherwise false.
     */
    protected hasDeniedFirstChar(property: string): boolean {
        return hasDeniedFirstChar(property)
    }

    /**
     * Checks if the given options object has all the required keys.
     * @param options The options object to check.
     * @returns True if all required keys are present, otherwise false.
     */
    protected static hasRequiredKeys(options: AnyObject): boolean {
        return this._requiredKeys !== undefined && this._requiredKeys?.every(requiredKey => !!options[requiredKey])
    }

    /**
     * Hydrates the store, potentially performing asynchronous operations.
     * @returns void or a Promise that resolves when hydration is complete.
     */
    hydrate(): void | Promise<void> {
        return
    }

    /**
     * Initializes the tracer for plugin subscriptions if the createTracer option is provided.
     * @param options The plugin subscription options containing the createTracer function.
     */
    private initializeTracer(options: PluginSubscriptionOptions) {
        this._createTracer = options?.createTracer
    }

    /**
     * Checks if the store is using the Options API.
     * @returns True if the store is using the Options API, otherwise false.
     */
    isOptionApi(): boolean { return this.store._isOptionsAPI }

    /**
     * Checks if the state object has the specified property.
     * @param property The property name to check.
     * @returns True if the state object has the property, otherwise false.
     */
    stateHas(property: string): boolean { return Object.prototype.hasOwnProperty.call(this.state, property) }

    /**
     * Checks if the store object has the specified property.
     * @param property The property name to check.
     * @returns True if the store object has the property, otherwise false.
     */
    storeHas(property: string): boolean { return Object.prototype.hasOwnProperty.call(this.store, property) }

    /**
     * Emits a structured trace event scoped to this store.
     * Prefer the factory form for `payload`: it is only resolved when consumed.
     */
    trace(namespace: string, payload?: TracePayload): void {
        if (this.tracer) {
            this.tracer.debug(namespace, payload)
        }
    }

    /**
     * Emits a structured error event, or rethrows it when no listener matches.
     */
    traceError(namespace: string, error: unknown, payload?: TracePayload): void {
        if (this.tracer) {
            this.tracer.error(namespace, error, payload)
        } else {
            console.error({ namespace, error, payload })
        }
    }
}