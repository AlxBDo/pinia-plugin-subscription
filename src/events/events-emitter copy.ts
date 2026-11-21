import { MessengerEmitter } from '../services/messenger-provider'
import type { Event } from '../types/events'

/**
 * Abstract class for emitting events.
 * Manages event subscribers and provides methods to emit events to them.
 */
export default class EventsEmitter extends MessengerEmitter {
    protected _messengerChannel = 'events'
}