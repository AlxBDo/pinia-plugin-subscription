import { MessengerSubscriber } from '../services/messenger-provider'
import EventSubscription from './events-subscription';
import type { Event, EventSubscription as EventSubscriptionInterface } from '../types/events';
import type { MessengerSubscriber as MessengerSubscriberInterface } from '../types/messenger';


/**
 * Abstract class for subscribing to events.
 * Manages event subscriptions and provides methods to consume events.
 */
export default class EventsSubscriber extends MessengerSubscriber implements MessengerSubscriberInterface {
    protected _messengerChannel = 'events'
    private _subscriptions: EventSubscriptionInterface[] = [];
    private _subscriptionsToConsume: EventSubscriptionInterface[] = [];


    constructor(id: string) {
        super(id, 'events')
    }


    set subscriptions(subscriptions: EventSubscriptionInterface[]) {
        this._subscriptions = subscriptions;
    }


    /**
     * Adds a new subscription for the specified event.
     * @param eventName The name of the event to subscribe to.
     * @param consumer The function to be called when the event is emitted.
     * @param options Additional options for the subscription, excluding the event name.
     */
    addSubscription(eventName: string, consumer: (...args: any[]) => void, options: Omit<Event, 'name'>): void {
        try {
            const subscription = new EventSubscription(eventName, consumer, options);
            this._subscriptions.push(subscription);
        } catch (error) {
            console.error('[EventsSubscriber] Error adding subscription:', error);
        }
    }

    /**
     * Consumes all subscriptions that match the specified event.
     * @param event The event to consume.
     */
    protected consume(event: Event): void {
        try {
            this._subscriptionsToConsume.forEach(sub => sub.consume(event));
        } catch (error) {
            console.error('[EventsSubscriber] Error consuming event:', error);
        }
        this._subscriptionsToConsume = [];
    }

    protected isCustomer(event: Event): boolean {
        this.initSubscriptionsToConsume(event);
        return this._subscriptionsToConsume.length > 0;
    }

    protected initSubscriptionsToConsume(event: Event): void {
        this._subscriptionsToConsume = this._subscriptions.filter(sub => {
            try {
                return sub.subscribed(event);
            } catch (error) {
                console.error('[EventsSubscriber] Error checking subscription:', error);
                return false;
            }
        });
    }

    /**
     * Unsubscribes from all events and clears all subscriptions.
     */
    override unsubscribe(): void {
        super.unsubscribe()
        this._subscriptions = [];
        this._subscriptionsToConsume = [];
    }
}