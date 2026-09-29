import { isRef, ref, toRef, type Ref } from "vue"
import Tracer from "../system/Tracer"
import { getDefineAStoreSetupContext, hasDeniedFirstChar, setEnhancedStore } from "../utils/store"
import { isEmpty } from "../utils/validation"

import type {
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
import type { StoreOptions, StatePropertyValue } from "../types/store"


export default class Store {
    protected _className = 'Store'
    private _onAction?: StoreOnActionSubscriptionCallback
    private _options: StoreOptions
    private _store: PiniaStore
    private _subscriptions: PluginSubscriptions = {}
    private _storeSubscribe?: StoreMutationSubscriptionCallback
    private _tracer?: Tracer

    protected static _requiredKeys?: string[]

    /**
     * Structured trace emitter of this store.
     * Built lazily so that subclasses overriding `_className` are reflected.
     */
    protected get tracer(): Tracer {
        if (!this._tracer) {
            this._tracer = new Tracer(this._className, {
                scope: this._store?.$id
            })
        }

        return this._tracer
    }

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


    constructor(store: PiniaStore, options: AnyObject) {
        this._options = options.storeOptions
        this._store = store

        if (this._options?.enhancedStore) {
            const ctx = getDefineAStoreSetupContext(this.store)

            if (ctx) {
                setEnhancedStore(ctx, this.store)
            }
        }
    }

    /**
     * Emits a structured trace event scoped to this store.
     * Prefer the factory form for `payload`: it is only resolved when consumed.
     */
    trace(namespace: string, payload?: TracePayload): void {
        this.tracer.debug(namespace, payload)
    }

    /**
     * Emits a structured error event, or rethrows it when no listener matches.
     */
    traceError(namespace: string, error: unknown, payload?: TracePayload): void {
        this.tracer.error(namespace, error, payload)
    }

    /**
     * Add property to state
     * @param name 
     * @param value 
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

    addSubscription(
        pluginName: string,
        subscription: PluginSubscriberInterface,
        options?: { subscriptionOptions?: StoreOptions, stores?: PiniaStore[] }
    ): void {
        this._subscriptions[pluginName] = { subscription, ...(options ?? {}) }
    }

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
        options: AnyObject
    ): Instance | undefined {
        if (options.storeOptions && this.hasRequiredKeys(options.storeOptions)) {
            return new this(store, options) as Instance
        }
    }

    getOption(optionName: keyof StoreOptions) {
        return this.options && (this.options as StoreOptions)[optionName]
    }

    getStatePropertyValue(propertyName: string) {
        return this.getValue(this.state[propertyName])
    }

    getSubscriptions(): PluginSubscriptions | undefined {
        if (isEmpty(this._subscriptions)) {
            return
        }

        return this._subscriptions
    }

    getValue(value: any) {
        return value?.__v_isRef ? value.value : value
    }

    protected hasDeniedFirstChar(property: string): boolean {
        return hasDeniedFirstChar(property)
    }

    protected static hasRequiredKeys(options: AnyObject): boolean {
        return this._requiredKeys !== undefined && this._requiredKeys?.every(requiredKey => !!options[requiredKey])
    }

    hydrate(): void | Promise<void> {
        return
    }

    isOptionApi(): boolean { return this.store._isOptionsAPI }

    stateHas(property: string): boolean { return Object.prototype.hasOwnProperty.call(this.state, property) }

    storeHas(property: string): boolean { return Object.prototype.hasOwnProperty.call(this.store, property) }
}