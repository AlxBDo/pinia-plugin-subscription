import type { MessengerSubscriber } from '../types/messenger'


export class Messenger {
    /**
     * List of subscribers.
     */
    private _subscribers: Record<string, MessengerSubscriber[]> = {}


    get subscribers(): Record<string, MessengerSubscriber[]> {
        return this._subscribers
    }


    /**
     * Adds a subscriber.
     * @param subscriber The subscriber to add.
     */
    addSubscriber(chanel: string, subscriber: MessengerSubscriber): void {
        if (!this._subscribers[chanel]) {
            this._subscribers[chanel] = []
        }
        this._subscribers[chanel].push(subscriber)
    }

    /**
     * Clears all subscribers.
     */
    clearSubscribers(): void {
        this._subscribers = {}
    }

    /**
     * Sends a payload to all subscribers.
     * @param payload The payload to send.
     */
    send(chanel: string, payload: unknown): void {
        if (!this._subscribers[chanel]) return
        this._subscribers[chanel].forEach(subscriber => subscriber.receive(payload))
    }

    /**
     * Removes a subscriber.
     * @param subscriber The subscriber to remove.
     */
    removeSubscriber(chanel: string, subscriber: MessengerSubscriber): void {
        if (!this._subscribers[chanel]) return
        this._subscribers[chanel] = this._subscribers[chanel].filter(s => s.id !== subscriber.id)
    }
}

export const PluginMessenger = new Messenger()