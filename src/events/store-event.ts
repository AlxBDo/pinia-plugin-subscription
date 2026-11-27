import Event from "./event"
import type { StoreEventConstructorOptions } from "../types/events"

export default class StoreEvent extends Event {
    public instanceId?: string

    constructor(name: string, { payload, scope, source, instanceId }: StoreEventConstructorOptions = {}) {
        super(name, { payload, scope, source })
        this.instanceId = instanceId
    }
}