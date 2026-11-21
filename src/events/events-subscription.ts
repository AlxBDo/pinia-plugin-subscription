import Event from './event';
import type { Event as EventInterface, EventSubscription as EventSubscriptionInterface } from '../types/events';

type EventKeys = keyof EventInterface;

export default class EventSubscription extends Event implements EventSubscriptionInterface {
    constructor(
        eventName: string,
        private _consumer: (...args: any[]) => void | Promise<void>,
        options: Omit<EventInterface, 'name'>
    ) {
        super(eventName, options);
    }

    /**
     * Consumes an event by invoking the consumer function.
     * Handles both synchronous and asynchronous consumers.
     * @param event The event to consume.
     */
    consume(event: EventInterface): void {
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

    subscribed(event: EventInterface): boolean {
        return Object.keys(event)?.every(
            key => !this[key as EventKeys] || event[key as EventKeys] === this[key as EventKeys]
        );
    }
}