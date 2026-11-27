import type { Event as EventInterface, EventPayload } from '../types/events'

export default class Event implements EventInterface {
    public payload?: EventPayload
    public scope?: string
    public source?: string

    constructor(
        public name: string,
        { payload, scope, source }: Omit<EventInterface, 'name'> = {}
    ) {
        this.payload = payload
        this.scope = scope
        this.source = source
    }
}