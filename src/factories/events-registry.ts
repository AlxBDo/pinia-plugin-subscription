import { createEventsSubscriber } from './events-subscriber'
import { createMessengerRegistry, generateSubscriberId } from './messenger-registry'
import EventsEmitter from '../events/events-emitter copy'
import EventSubscription from '../events/events-subscription'
import Messenger from '../services/messenger'


export function createEventsRegistry() {
    const subscriberIdCount: Record<string, number> = {}

    return createMessengerRegistry(
        'events',
        (messenger: Messenger) => (
            id: string, eventSubscriptions?: unknown[]
        ) => createEventsSubscriber(
            messenger,
            generateSubscriberId(id, subscriberIdCount),
            eventSubscriptions as EventSubscription[]
        ),
        EventsEmitter
    )
}