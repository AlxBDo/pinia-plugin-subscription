import type EventSubscriber from '../events/events-subscriber'
import type { MessengerRegistry } from "../types/messenger"
import type StoresEventsSubscriptionsRegistry from '../events/stores-events-subscriptions-registry'


export interface Event {
    name: string
    payload?: EventPayload
    scope?: string
    source?: string
}

export type EventConstructorOptions = Omit<Event, 'name'>

export type EventPayload<T = Record<string, unknown> | unknown[]> = () => T | T

export interface EventRegistry extends Omit<MessengerRegistry, "createSubscriber"> {
    createSubscriber: EventsSubscriberFactory
    subscriptionsRegistry: StoresEventsSubscriptionsRegistry
}

export interface EventSubscription extends Partial<StoreEvent> {
    consume: (event: Event | StoreEvent) => void
    subscribed: (event: Event | StoreEvent) => boolean
}

export type EventsSubscriberFactory = (id: string, eventSubscriptions?: EventSubscription[]) => EventSubscriber

export interface StoreEvent extends Event {
    instanceId?: string
}

export type StoreEventConstructorOptions = Omit<StoreEvent, 'name'>