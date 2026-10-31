import Tracer from '../system/Tracer'
import { createTraceJournal } from '../system/TraceJournal'
import { createTraceGroupListener } from './trace-listener'
import type {
    AddTraceListenerOptions,
    TraceEvent,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceGroupListener,
    TraceListenerRemover,
    TraceRegistry,
    TracerOptions,
    TracerRegistryOptions,
} from '../types/trace'
import { isProductionEnvironment } from '../utils/environment'
import { createRedactor } from '../utils/redact'


const noop = () => { }

export function createTracerRegistry(
    { enabled = !isProductionEnvironment(), journal: journalOption = false, redact = false, side }: TracerRegistryOptions = {}
): TraceRegistry {
    const journal = enabled && journalOption
        ? createTraceJournal(journalOption === true ? {} : journalOption)
        : undefined
    const tracerSide = side ?? (typeof window === 'undefined' ? 'server' : 'client')
    const redactor = redact ? createRedactor(redact === true ? true : redact) : undefined

    // Shared by reference with every Tracer: it must be mutated in place, never reassigned.
    const listeners: TraceGroupListener[] = []

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
        if (!enabled) {
            return noop
        }

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
     * Adds a trace listener for specific scopes.
     * @param scopes The scopes to listen for.
     * @param context Print the plugin context (subscribers, store, options, and traces) to the console.. Defaults to true.
     * @returns A function that removes the registered trace group listener when called.
     */
    function addScopesListener(scopes: string[], context = true): TraceListenerRemover {
        return addListener(
            scopes.map(scope => ({ target: 'scope', value: scope })),
            { context, filterMode: 'some', groupBy: 'scope' }
        )
    }

    /**
     * Clears all registered trace listeners.
     */
    function clearTraceListeners(): void {
        listeners.length = 0
    }

    function getMatchedListener(payload: TraceEvent) {
        const metadata = {
            groupId: payload.groupId,
            label: payload.label,
            level: payload.level,
            namespace: payload.namespace,
            scope: payload.scope,
            source: payload.source
        }

        return listeners.filter(listener => listener.filter(metadata))
    }

    /**
     * Checks if there are any registered trace listeners.
     * @returns True if there are registered trace listeners, otherwise false.
     */
    function hasTraceListeners(): boolean {
        return listeners.length > 0 || !!journal
    }

    function listenerGroupAction(actionName: 'createGroup' | 'logGroup', payload: TraceEvent) {
        if (!listeners.length) return

        getMatchedListener(payload).forEach(listener => {
            const groupLabel = payload.groupId ?? payload[listener.groupBy]
            if (typeof groupLabel === 'string') { listener[actionName](groupLabel) }
        })
    }


    return {
        addListener,
        addScopesListener,
        clearTraceListeners,
        journal,
        tracerHandler: {
            closeGroup: (payload: TraceEvent) => listenerGroupAction('logGroup', payload),
            createTracer: (source: string, options: TracerOptions = {}) => new Tracer(source, listeners, { journal, redactor, side: tracerSide, ...options }),
            hasTraceListeners,
            startGroup: (payload: TraceEvent) => listenerGroupAction('createGroup', payload)
        },
        hasTraceListeners
    }
}