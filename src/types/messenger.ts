export interface MessengerSubscriber {
    clear(): void
    id: string
    receive(payload: unknown): void
}