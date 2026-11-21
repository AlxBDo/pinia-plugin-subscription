export interface MessengerSubscriber {
    id: string
    receive(payload: unknown): void
}