import Store from "../core/Store";
import type { PiniaPluginContext, Store as PiniaStore } from "pinia";
import type { AnyObject } from "../types";
import type {
    PluginSubscriber as PluginSubscriberInterface,
    PluginSubscriptions,
    StoreMutationSubscription,
    StoreOnActionSubscription
} from "../types/plugin";
import { Console } from "../types/log";


type CreateInstance<Instance = Store> = (store: PiniaStore, options: AnyObject, debug: boolean, customConsole?: Console) => Instance | undefined


export default abstract class PluginSubscriber<Instance extends Store> implements PluginSubscriberInterface {
    private _console?: Console
    private _createInstance: CreateInstance
    private _name: string
    private _pluginOptions?: AnyObject
    private _storeInstance?: Instance
    protected _resetStoreCallback?: (store?: Store) => void
    private _storeOnActionSubscription?: StoreOnActionSubscription
    private _storeMutationSubscription?: StoreMutationSubscription
    private _subscriptions?: PluginSubscriptions
    protected pluginCreated?: (store: PiniaStore) => void


    get console(): Console {
        return this._console ?? console
    }

    get name(): string {
        return this._name;
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


    constructor(pluginName: string, createInstanceFunction: CreateInstance, pluginConsole?: Console) {
        this._name = pluginName
        this._createInstance = createInstanceFunction

        if (pluginConsole) {
            this._console = pluginConsole
        }
    }


    public invoke(
        { store, options }: PiniaPluginContext,
        debug: boolean
    ): void {
        this._storeInstance = this._createInstance(store, { ...options, ...this.pluginOptions }, debug, this.console) as Instance

        if (!this._storeInstance) {
            return
        }

        this._subscriptions = this._storeInstance.getSubscriptions()
        this._storeMutationSubscription = this._storeInstance.storeSubscribe
        this._storeOnActionSubscription = this._storeInstance.onAction

        if (this.pluginCreated) {
            this.pluginCreated(store)
        }
    }
}