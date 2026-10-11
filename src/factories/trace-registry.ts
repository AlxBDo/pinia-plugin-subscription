import Tracer from '../system/Tracer'
import { createTraceGroupListener, createTraceListener } from './trace-listener'
import type {
    AddTraceListenerOptions,
    TraceEvent,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceGroupListener,
    TraceListener,
    TraceListenerFilterMode,
    TraceListenerRemover,
    TraceRegistry,
    TracerOptions,
} from '../types/trace'

/**
 * Creates a registry for managing trace listeners and creating tracers.
 * @returns An object containing methods to add and clear trace listeners, and to create tracers.
 */
export function createTracerRegistry(): TraceRegistry {
    let listeners: TraceListener[] = []

    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listener The trace listener to register.
     * @param filterMode The mode to use when creating a trace listener from a filter factory parameter. Defaults to 'every'.
     * @returns A function that removes the registered listener when called.
     */
    function addTraceListener(listener: TraceListener | TraceFilterFactoryParam, filterMode: TraceListenerFilterMode = 'every'): TraceListenerRemover {
        if (!listener || !listener?.handler) {
            listener = createTraceListener(listener, filterMode)
        }

        if (!('filter' in listener) || typeof listener.filter !== 'function') {
            listener = { ...listener, filter: () => true }
        }

        listeners.push(listener as TraceListener)

        return () => {
            const index = listeners.indexOf(listener as TraceListener)

            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * Clears all registered trace listeners.
     */
    function clearTraceListeners(): void {
        listeners = []
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

export function createTraceGroupsRegistry() {
    let listeners: TraceGroupListener[] = []

    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listener The trace listener to register.
     * @param filterMode The mode to use when creating a trace listener from a filter factory parameter. Defaults to 'every'.
     * @returns A function that removes the registered listener when called.
     */
    function addListener(
        criteria: TraceFilterFactoryCriterion[],
        { filterMode = 'every', groupBy = 'scope' }: AddTraceListenerOptions = {}
    ): TraceListenerRemover {
        const listenerGroup = createTraceGroupListener(criteria, filterMode ?? 'every', groupBy ?? 'scope')
        listeners.push(listenerGroup)

        return () => {
            const index = listeners.indexOf(listenerGroup)

            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * Clears all registered trace listeners.
     */
    function clearTraceListeners(): void {
        listeners = []
    }

    function getMatchedListener(payload: TraceEvent) {
        return listeners.filter(listener => listener.filter(payload))
    }

    /**
     * Checks if there are any registered trace listeners.
     * @returns True if there are registered trace listeners, otherwise false.
     */
    function hasTraceListeners(): boolean {
        return listeners.length > 0
    }

    function listenerGroupAction(actionName: 'createGroup' | 'logGroup', payload: TraceEvent) {
        if (!listeners.length) return

        getMatchedListener(payload).forEach(listener => {
            const groupLabel = payload[listener.groupBy]
            if (typeof groupLabel === 'string') { listener[actionName](groupLabel) }
        })
    }


    return {
        addListener,
        clearTraceListeners,
        tracerHandler: {
            closeGroup: (payload: TraceEvent) => listenerGroupAction('logGroup', payload),
            createTracer: (source: string, options: TracerOptions = {}) => new Tracer(source, listeners, options),
            startGroup: (payload: TraceEvent) => listenerGroupAction('createGroup', payload)
        },
        hasTraceListeners
    }
}