import type { Store } from 'pinia';

export default class StoreEventsSubscriber {
    private _id?: string
    private _storeId?: string
    private _subscriptions: Record<string, (...args: any[]) => void>

    get id() {
        return this._id;
    }

    get subscriptions() {
        return this._subscriptions;
    }

    constructor(id: string, store: Store, subscriptions?: Record<string, (...args: any[]) => void>) {
        this._id = id;
        this._storeId = store.$id;
        this._subscriptions = subscriptions ?? {};
    }

    public clear() {
        this._subscriptions = {};
        this._storeId = undefined;
        this._id = undefined;
    }

    public getSubscription(event: string, store: Store) {
        return this._storeId === store.$id ? this._subscriptions?.[event] : undefined;
    }

    public hasSubscription(event: string, store: Store) {
        return this._storeId === store.$id && !!this._subscriptions?.[event];
    }

    public hasSubscriptions(store: Store) {
        return this._storeId === store.$id && Object.keys(this._subscriptions ?? {}).length > 0;
    }

    public shouldPropagateError(_event: string): boolean {
        return false
    }

    subscribe(event: string, handler: (...args: any[]) => void) {
        this._subscriptions[event] = handler;
    }

    protected unsubscribe(event: string) {
        delete this._subscriptions?.[event];
    }
}