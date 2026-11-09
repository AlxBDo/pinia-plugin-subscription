import { EventsHandler } from './events-handler'

export class EventsStoreHandler extends EventsHandler {
    private _events: string[] = []
    private _storeId: string

    constructor(storeId: string) {
        super()
        this._storeId = storeId
    }

    public clear() {
        for (const event of this._events) {
            super.off(`${this._storeId}:${event}`, () => { })
        }
        this._events = []
    }

    public on(event: string, listener: Function) {
        super.on(`${this._storeId}:${event}`, listener)
        this._events.push(event)
    }
}