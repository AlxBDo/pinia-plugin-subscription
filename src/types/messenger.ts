import Messenger from "../services/messenger"

export type SubscriberFactory = (...optionalArgs: unknown[]) => MessengerSubscriber

export type CreateSubscriberFactory = (messenger: Messenger) => SubscriberFactory

export interface MessengerEmitter {
    emit(payload: unknown): void
}

export interface MessengerProvider {
    messenger: Messenger
    messengerChannel: string
}

export interface MessengerRegistry {
    emitter: MessengerEmitter,
    createSubscriber: CreateSubscriberFactory
}

export interface MessengerSubscriber {
    id: string
    receive(payload: unknown): void
    clear(): void
    unsubscribe(): void
}