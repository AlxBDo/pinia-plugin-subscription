import type { MessengerSubscriber } from '../types/messenger'


export default class Messenger {
    /**
     * List of subscribers.
     */
    private _subscribers: Map<string, MessengerSubscriber[]> = new Map()


    get subscribers(): Map<string, MessengerSubscriber[]> {
        return this._subscribers
    }


    /**
     * Adds a subscriber.
     * @param subscriber The subscriber to add.
     */
    addSubscriber(chanel: string, subscriber: MessengerSubscriber): void {
        if (!this._subscribers.has(chanel)) {
            this._subscribers.set(chanel, [])
        }
        this._subscribers.get(chanel)!.push(subscriber)
    }

    /**
     * Clears all subscribers.
     */
    clearSubscribers(): void {
        this._subscribers.forEach(subscribers => {
            subscribers.forEach(subscriber => subscriber.clear())
        })
        this._subscribers = new Map()
    }

    /**
     * Sends a payload to all subscribers.
     * @param payload The payload to send.
     */
    send(chanel: string, payload: unknown): void {
        if (!this._subscribers.has(chanel)) return
        this._subscribers.get(chanel)!.forEach(subscriber => subscriber.receive(payload))
    }

    /**
     * Removes a subscriber.
     * @param subscriber The subscriber to remove.
     */
    removeSubscriber(chanel: string, subscriber: MessengerSubscriber): void {
        if (!this._subscribers.has(chanel)) return
        this._subscribers.set(
            chanel,
            this._subscribers.get(chanel)!.filter(s => s.id !== subscriber.id)
        )
    }
}

export const PluginMessenger = new Messenger()