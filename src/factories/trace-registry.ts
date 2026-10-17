import Tracer from '../system/Tracer'
import { createTraceGroupListener } from './trace-listener'
import type {
    AddTraceListenerOptions,
    TraceEvent,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceGroupListener,
    TraceListenerRemover,
    TracerOptions,
} from '../types/trace'


export function createTracerRegistry() {
    let listeners: TraceGroupListener[] = []

    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listenerDef The listener definition or filter criteria for the trace group listener.
     * @param context Print the plugin context (subscribers, store, options, and traces) to the console.. Defaults to true.
     * @param filterMode The mode to use when creating the trace group listener from the listener definition or criteria. Defaults to 'every'.
     * @param groupBy The property to group traces by. Defaults to 'scope'.
     * @returns A function that removes the registered trace group listener when called.
     */
    function addListener(
        listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
        { context = true, filterMode = 'every', groupBy = 'scope' }: AddTraceListenerOptions = {}
    ): TraceListenerRemover {
        const listenerGroup = createTraceGroupListener(
            listenerDef, !!context, filterMode ?? 'every', groupBy ?? 'scope')
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