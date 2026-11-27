import Messenger from '../services/messenger'
import type { MessengerEmitter, MessengerSubscriber } from '../services/messenger-provider'

/**
 * Factory function to create a messenger registry.
 * Provides an emitter and a method to create subscribers with unique IDs.
 * @template S The type of the messenger subscriber.
 * @template E [optional] The type of the messenger emitter, defaults to MessengerEmitter.
 * @param channel The messenger channel to use for the emitter and subscribers.
 * @param createSubscriber The factory function to create subscribers.
 * @param Emitter The constructor for the messenger emitter..
 * @returns An object containing the emitter and a method to create subscribers.
 */
export function createMessengerRegistry<
    S extends MessengerSubscriber,
    E extends MessengerEmitter = MessengerEmitter
>(
    channel: string,
    createSubscriber: (messenger: Messenger) => (id: string, optionalArgs?: unknown[]) => S,
    Emitter: new (messenger: Messenger, channel: string) => E
) {
    const messenger = new Messenger()

    return {
        emitter: new Emitter(messenger, channel),
        createSubscriber: createSubscriber(messenger)
    }
}