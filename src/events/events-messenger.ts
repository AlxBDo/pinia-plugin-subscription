import type { Event } from '../types/events'
import type { MessengerSubscriber } from '../types/messenger'

/**
 * Abstract class for emitting events.
 * Manages event subscribers and provides methods to emit events to them.
 */
export default class EventsMessengerClass {
    /**
     * List of event subscribers.
     */
    protected _eventsSubscribers: MessengerSubscriber[] = []


    /**
     * Adds a subscriber.
     * @param subscriber The subscriber to add.
     */
    addSubscriber(subscriber: MessengerSubscriber): void {
        this._eventsSubscribers.push(subscriber)
    }

    /**
     * Clears all subscribers.
     */
    clearSubscribers(): void {
        this._eventsSubscribers = []
    }

    /**
     * Sends an event to all subscribers.
     * @param event The event to send.
     */
    send(event: Event): void {
        this._eventsSubscribers.forEach(subscriber => subscriber.receive(event))
    }

    /**
     * Removes a subscriber.
     * @param subscriber The subscriber to remove.
     */
    removeSubscriber(subscriber: MessengerSubscriber): void {
        this._eventsSubscribers = this._eventsSubscribers.filter(s => s.id !== subscriber.id)
    }
}

export const EventsMessenger = new EventsMessengerClass()