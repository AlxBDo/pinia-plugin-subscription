import EventsEmitter from './events-emitter copy'
import type { Store } from 'pinia'
import type { EventPayload } from '../types/events'

const StoreEventsEmitter = new EventsEmitter()

export function emitStoreEvent(store: Store, event: string, payload?: EventPayload) {
    StoreEventsEmitter.emit({ name: event, scope: store.$id, payload })
}