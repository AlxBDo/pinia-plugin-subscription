import { ref, toRef, type Ref } from "vue"
import { eppsLog } from "../utils/log"

import type { Store as PiniaStore, StateTree } from "pinia"
import type { AnyObject } from "../types"
import type { StoreOptions, PluginStoreOptions, StatePropertyValue } from "../types/store"
import { hasDeniedFirstChar } from "../utils/store"


export default class Store {
    private _debug: boolean = false
    private _options: StoreOptions
    private _store: PiniaStore

    get debug(): boolean { return this._debug }
    set debug(debug: boolean) { this._debug = debug }

    get options(): StoreOptions { return this._options }

    get state(): StateTree { return this._store.$state }

    set state(state: StateTree) { this._store.$state = state }

    get store(): AnyObject { return this._store }


    constructor(store: PiniaStore, options: PluginStoreOptions, debug: boolean = false) {
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

    /**
     * Create and return a class instance
     * @param store 
     * @param options 
     * @param debug 
     * @returns 
     */
    static customizeStore<Instance extends Store>(
        store: PiniaStore,
        options: PluginStoreOptions,
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

    getValue(value: any) {
        return value?.__v_isRef ? value.value : value
    }

    isOptionApi(): boolean { return this.store._isOptionsAPI }

    stateHas(property: string): boolean { return this.state.hasOwnProperty(property) }

    storeHas(property: string): boolean { return this.store.hasOwnProperty(property) }
}