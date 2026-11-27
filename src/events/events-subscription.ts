import Event from './event';
import StoreEvent from './store-event';
import type { Event as EventInterface, EventSubscription as EventSubscriptionInterface, StoreEvent as StoreEventInterface, StoreEventConstructorOptions } from '../types/events';

type EventKeys = keyof StoreEventInterface;

export default class EventSubscription extends StoreEvent implements EventSubscriptionInterface {
    constructor(
        eventName: string,
        private _consumer: (...args: any[]) => void | Promise<void>,
        options?: StoreEventConstructorOptions
    ) {
        super(eventName, options);
    }

    /**
     * Consumes an event by invoking the consumer function.
     * Handles both synchronous and asynchronous consumers.
     * @param event The event to consume.
     */
    consume(event: EventInterface | StoreEventInterface): void {
        const reportError = (error: unknown) =>
            console.error('[EventSubscription] Error consuming event:', error)

        try {
            const result = this._consumer(event);
            if (
                result !== null && (
                    typeof result === 'object' || typeof result === 'function'
                )
                && 'then' in result && typeof result.then === 'function'
            ) { void Promise.resolve(result).catch(reportError) }
        } catch (error) {
            reportError(error);
        }
    }

    subscribed(event: StoreEventInterface): boolean {
        return this.name === event.name && ['payload', 'scope', 'source', 'instanceId'].every(
            key => !this[key as EventKeys] || (
                event[key as EventKeys] && event[key as EventKeys] === this[key as EventKeys]
            )
        );
    }
}