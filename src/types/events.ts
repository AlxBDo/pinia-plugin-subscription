export interface Event {
    name: string
    payload?: EventPayload
    scope?: string
    source?: string
}

export type EventPayload = () => Record<string, unknown> | unknown[] | (Record<string, unknown> | unknown[])

export interface EventSubscription extends Partial<Event> {
    consume: (event: Event) => void
    subscribed: (event: Event) => boolean
}