import { ref, toRef, type Ref } from "vue"
import { eppsLog } from "../utils/log"
import { hasDeniedFirstChar } from "../utils/store"
import { isEmpty } from "../utils/validation"

import type {
    PluginSubscription,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreMutationSubscriptionCallback,
    StoreMutationSubscriptionReturn,
    StoreOnActionSubscription,
    StoreOnActionSubscriptionCallback,
    StoreOnActionSubscriptionReturn
} from "../types/plugin"
import type { Store as PiniaStore, StateTree } from "pinia"
import type { AnyObject } from "../types"
import type { StoreOptions, StatePropertyValue } from "../types/store"


export default class Store {
    private _debug: boolean = false
    private _onAction?: StoreOnActionSubscriptionCallback
    private _options: StoreOptions
    private _store: PiniaStore
    private _subscriptions: PluginSubscriptions = {}
    private _storeSubscribe?: StoreMutationSubscriptionCallback

    get debug(): boolean { return this._debug }
    set debug(debug: boolean) { this._debug = debug }

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


    constructor(store: PiniaStore, options: AnyObject, debug: boolean = false) {
        this._debug = debug
        this._options = options.storeOptions
        this._store = store
    }

    /**
     * Add property to state
     * @param name 
     * @param value 
     */
    addToState(name: string, value?: StatePropertyValue): void {
        if (!this.isOptionApi()) {
            if (!(value as Ref)?.value) {
                value = ref<StatePropertyValue>(value)
            }
        }

        this.state[name] = value
        this.store[name] = toRef(this.state, name)
    }

    addSubscription(pluginName: string, subscription: PluginSubscription): void {
        this._subscriptions[pluginName] = subscription
    }

    /**
     * Create and return a class instance
     * @param store 
     * @param options 
     * @param debug 
     * @returns 
     */
    static customizeStore<Instance extends Store>(
        store: PiniaStore,
        options: AnyObject,
        debug: boolean = false
    ): Instance | undefined {
        if (options.storeOptions) {
            return new this(store, options, debug) as Instance
        }
    }

    debugLog(message: string, args: any): void {
        if (this._debug) { eppsLog(message, args) }
    }

    hasDeniedFirstChar(property: string): boolean {
        return hasDeniedFirstChar(property[0] as string)
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

    isOptionApi(): boolean { return this.store._isOptionsAPI }

    stateHas(property: string): boolean { return this.state.hasOwnProperty(property) }

    storeHas(property: string): boolean { return this.store.hasOwnProperty(property) }
}