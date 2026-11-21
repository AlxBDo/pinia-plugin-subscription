import { MessengerEmitter } from '../services/messenger-provider'
import type Messenger from '../services/messenger'

/**
 * Abstract class for emitting events.
 * Manages event subscribers and provides methods to emit events to them.
 */
export default class EventsEmitter extends MessengerEmitter {
    constructor(messenger: Messenger) {
        super(messenger, 'events')
    }
}