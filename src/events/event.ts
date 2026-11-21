import type { Event as EventInterface, EventPayload } from '../types/events'

export default abstract class Event implements EventInterface {
    protected _name: string
    protected _payload?: EventPayload
    protected _scope?: string
    protected _source?: string


    get name(): string {
        return this._name
    }

    get payload(): EventPayload | undefined {
        return this._payload
    }

    get scope(): string | undefined {
        return this._scope
    }

    get source(): string | undefined {
        return this._source
    }


    constructor(name: string, { payload, scope, source }: Omit<EventInterface, 'name'>) {
        this._name = name
        this._payload = payload
        this._scope = scope
        this._source = source
    }
}