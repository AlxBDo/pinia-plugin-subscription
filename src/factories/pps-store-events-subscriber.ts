import { createEventsSubscriber } from './events-subscriber';
import { definePPSEventSubscriberId } from '../utils/events';

import type { Store } from 'pinia';
import type { EventSubscription as EventSubscription } from '../types/events';

/**
 * Creates a store-specific events subscriber.
 * @param store The Pinia store instance.
 * @param eventSubscriptions The list of event subscriptions to initialize the subscriber with.
 * @returns An instance of EventsSubscriber configured for the specified store.
 */
export function createStoreEventsSubscriber(store: Store, eventSubscriptions?: EventSubscription[]) {
    return createEventsSubscriber(definePPSEventSubscriberId(store), eventSubscriptions);
}