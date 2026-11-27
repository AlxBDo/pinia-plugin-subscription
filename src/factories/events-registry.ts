import { createEventsSubscriber } from './events-subscriber'
import { createMessengerRegistry } from './messenger-registry'
import EventsEmitter from '../events/events-emitter'
import Messenger from '../services/messenger'
import { generateUniqueId } from '../utils/id'
import StoresEventsSubscriptionsRegistry from '../events/stores-events-subscriptions-registry'
import type EventSubscriber from '../events/events-subscriber'
import type { EventSubscription } from '../types/events'


export function createEventsRegistry(): {
    emitter: EventsEmitter,
    createSubscriber: (id: string, eventSubscriptions?: EventSubscription[]) => EventSubscriber,
    subscriptionsRegistry: StoresEventsSubscriptionsRegistry
} {
    return {
        ...createMessengerRegistry(
            'events',
            (messenger: Messenger) => (
                id: string, eventSubscriptions?: unknown[]
            ) => createEventsSubscriber(
                messenger,
                generateUniqueId(id),
                eventSubscriptions as EventSubscription[]
            ),
            EventsEmitter
        ),
        subscriptionsRegistry: new StoresEventsSubscriptionsRegistry()
    }
}