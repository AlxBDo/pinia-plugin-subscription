/**
 * Factory function to create an event listener object.
 * @param id - The unique identifier for the event listener.
 * @param event - The name of the event to listen for.
 * @param callback - The callback function to execute when the event is triggered.
 * @returns An object representing the event listener.
 */
export function createEventListener(id: string, event: string, callback: (...args: any[]) => void) {
    return { id, event, callback };
}