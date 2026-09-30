import Tracer from '../system/Tracer'
import type { TraceListener, TraceListenerRemover, TraceRegistry, TracerOptions } from '../types/trace'

/**
 * Creates a registry for managing trace listeners and creating tracers.
 * @returns An object containing methods to add and clear trace listeners, and to create tracers.
 */
export function createTracerRegistry(): TraceRegistry {
    const listeners: TraceListener[] = []

    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     */
    function addTraceListener(listener: TraceListener): TraceListenerRemover {
        listeners.push(listener)

        return () => {
            const index = listeners.indexOf(listener)

            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * Clears all registered trace listeners.
     */
    function clearTraceListeners(): void {
        listeners.length = 0
    }

    /**
     * Checks if there are any registered trace listeners.
     * @returns True if there are registered trace listeners, otherwise false.
     */
    function hasTraceListeners(): boolean {
        return listeners.length > 0
    }

    return {
        addTraceListener,
        clearTraceListeners,
        createTracer: (source: string, options: TracerOptions = {}) => new Tracer(source, listeners, options),
        hasTraceListeners
    }
}