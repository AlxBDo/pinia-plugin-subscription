import EventsSubscriber from '../events/events-subscriber';
import type Messenger from '../services/messenger'
import type { EventSubscription as EventSubscription } from '../types/events';


/**
 * Creates a events subscriber.
 * @param messenger The messenger instance to be used by the events subscriber.
 * @param id The unique identifier for the events subscriber.
 * @param eventSubscriptions The list of event subscriptions to initialize the subscriber with.
 * @returns An instance of EventsSubscriber configured for the specified store.
 */
export function createEventsSubscriber(
    messenger: Messenger,
    id: string,
    eventSubscriptions?: EventSubscription[]
) {
    const subscriber = new EventsSubscriber(messenger, id);
    if (eventSubscriptions) {
        subscriber.subscriptions = eventSubscriptions;
    }
    return subscriber;
}