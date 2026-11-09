import type { Store } from 'pinia'
import type StoreEventsSubscriber from './store-events-subscriber'

export default class StoreEventsSubscriberHandler {
    private _subscribers: Map<string, StoreEventsSubscriber[]> = new Map()

    public clearSubscribers(storeId: string): void {
        const subscribers = this._subscribers.get(storeId)
        subscribers?.forEach(subscriber => subscriber.clear())
        this._subscribers.delete(storeId)
    }

    public emit(store: Store, event: string, getArgs?: () => any[]): void {
        const subscribers = this.getSubscribers(store.$id)
        const errors: unknown[] = []

        for (const subscriber of subscribers) {
            try {
                const subscription = subscriber.getSubscription(event, store)
                if (typeof subscription === 'function') { subscription(...(getArgs?.() ?? [])) }
            } catch (error) {
                if (subscriber.shouldPropagateError(event)) {
                    errors.push(error)
                } else {
                    console.error(`Error emitting event '${event}' for store '${store.$id}':`, error)
                }
            }
        }
        if (errors.length === 1) {
            throw errors[0]
        }
        if (errors.length > 1) {
            throw new AggregateError(errors, `Errors emitting event '${event}' for store '${store.$id}'`)
        }
    }

    public getSubscribers(storeId: string): StoreEventsSubscriber[] {
        return this._subscribers.get(storeId) ?? []
    }

    public subscribe(storeId: string, subscriber: StoreEventsSubscriber): void {
        if (!this._subscribers.has(storeId)) {
            this._subscribers.set(storeId, [])
        }
        this._subscribers.get(storeId)?.push(subscriber)
    }
}