import Messenger from './messenger'
import type {
    MessengerEmitter as MessengerEmitterInterface,
    MessengerProvider as MessengerProviderInterface,
    MessengerSubscriber as MessengerSubscriberInterface
} from '../types/messenger'

/**
 * Abstract class providing access to the events messenger.
 * Manages the messenger instance and provides a getter for it.
 */
export default abstract class MessengerProvider implements MessengerProviderInterface {
    get messenger() {
        return this._messenger
    }

    get messengerChannel() {
        return this._messengerChannel
    }

    constructor(
        private readonly _messenger: Messenger,
        protected _messengerChannel: string
    ) { }
}

export class MessengerEmitter extends MessengerProvider implements MessengerEmitterInterface {
    /**
     * Emits an event to all subscribers.
     * @param payload The payload to emit.
     */
    emit(payload: unknown): void {
        this.messenger.send(this._messengerChannel, payload)
    }
}


/**
 * Abstract class for subscribing to messenger events.
 * Manages subscriptions and provides a method to receive payloads.
 */
export abstract class MessengerSubscriber extends MessengerProvider implements MessengerSubscriberInterface {
    get id(): string {
        return this._id;
    }


    constructor(
        messenger: Messenger,
        messengerChannel: string,
        private readonly _id: string
    ) {
        super(messenger, messengerChannel)
        this.subscribe()
    }

    /**
     * overide this method to clear subscriptions
     */
    clear(): void {
        return
    }

    protected abstract consume(payload: unknown): void;

    protected abstract isCustomer(payload: unknown): boolean;

    /**
     * Receives a payload and processes it if there are matching subscriptions.
     * @param payload The payload to receive.
     */
    receive(payload: unknown): void {
        if (this.isCustomer(payload)) {
            this.consume(payload);
        }
    }

    private subscribe(): void {
        this.messenger.addSubscriber(this._messengerChannel, this);
    }

    /**
     * Unsubscribes from the messenger channel.
     */
    unsubscribe(): void {
        try {
            this.messenger.removeSubscriber(this._messengerChannel, this);
            this.clear();
        } catch (error) {
            console.error('[MessengerSubscriber] Error unsubscribing:', error);
        }
    }
}