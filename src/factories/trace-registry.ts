import Tracer from '../system/Tracer'
import { createTraceJournal } from '../system/TraceJournal'
import { createTraceListener } from './trace-listener'
import type {
    AddTraceListenerOptions,
    TraceEvent,
    TraceHandler,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceListener,
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
    const listeners: TraceListener[] = []

    // Open groups per scope, innermost last: events emitted meanwhile by subscribers join the innermost one.
    const openGroups = new Map<string, string[]>()
    const currentGroupId = (scope?: string) => {
        const stack = scope ? openGroups.get(scope) : undefined
        return stack?.[stack.length - 1]
    }

    /**
     * Registers a trace listener and returns its remover.
     * Listeners are evaluated in registration order.
     * @param listenerDef The listener definition or filter criteria for the trace group listener.
     * @param context Also match the plugin's own context events. Defaults to true.
     * @param filterMode The mode to use when creating the listener from the criteria. Defaults to 'every'.
     * @returns A function that removes the registered listener when called.
     */
    function addListener(
        listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
        { context = true, filterMode = 'every' }: AddTraceListenerOptions = {}
    ): TraceListenerRemover {
        if (!enabled) {
            return noop
        }

        const listener = createTraceListener(listenerDef, !!context, filterMode ?? 'every')
        listeners.push(listener)

        return () => {
            const index = listeners.indexOf(listener)

            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * Adds a trace listener for specific scopes.
     * @param scopes The scopes to listen for.
     * @param context Also match the plugin's own context events. Defaults to true.
     * @returns A function that removes the registered listener when called.
     */
    function addScopesListener(scopes: string[], context = true, handler?: TraceHandler): TraceListenerRemover {
        return addListener(
            { filter: scopes.map(scope => ({ target: 'scope', value: scope })), handler },
            { context, filterMode: 'some' }
        )
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
        return listeners.length > 0 || !!journal
    }

    function trackGroup(action: 'close' | 'open', { groupId, scope }: TraceEvent) {
        if (!groupId || !scope) { return }

        const stack = openGroups.get(scope) ?? []
        if (action === 'open') {
            stack.push(groupId)
            openGroups.set(scope, stack)
            return
        }

        const index = stack.lastIndexOf(groupId)
        if (index >= 0) { stack.splice(index, 1) }
        if (!stack.length) { openGroups.delete(scope) }
    }


    return {
        addListener,
        addScopesListener,
        clearTraceListeners,
        journal,
        tracerHandler: {
            closeGroup: (payload: TraceEvent) => trackGroup('close', payload),
            createTracer: (source: string, options: TracerOptions = {}) => new Tracer(source, listeners, { currentGroupId, journal, redactor, side: tracerSide, ...options }),
            hasTraceListeners,
            journal,
            startGroup: (payload: TraceEvent) => trackGroup('open', payload)
        },
        hasTraceListeners
    }
}