export class EventsHandler {
    private _eventListeners: Map<string, Function[]> = new Map()
    private _eventsSubscribers: Map<string, Function[]> = new Map()

    public emit(event: string, ...args: unknown[]) {
        const listeners = this._eventListeners.get(event)
        if (listeners) {
            for (const listener of listeners) {
                listener(...args)
            }
        }
    }

    public off(event: string, listener: Function) {
        const listeners = this._eventListeners.get(event)
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    public on(event: string, listener: Function) {
        if (!this._eventListeners.has(event)) {
            this._eventListeners.set(event, [])
        }
        this._eventListeners.get(event)?.push(listener)
    }
}