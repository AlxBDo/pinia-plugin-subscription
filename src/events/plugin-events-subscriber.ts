import EventsSubscriber from './events-subscriber'
import { definePPSEventSubscriberId } from '../utils/events'
import type { Store } from 'pinia'


export class PluginEventsSubscriber extends EventsSubscriber {
    constructor(store: Store) {
        super(definePPSEventSubscriberId(store))
    }
}