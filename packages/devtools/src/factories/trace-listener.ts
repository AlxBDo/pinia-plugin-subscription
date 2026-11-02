import { pluginName, pluginSubscriptionNamespace } from "../utils/constants"

import type {
    TraceEventMetadata,
    TraceFilter,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceListener
} from "../types/trace"

const noop = () => { }


function createFilter(criteria: TraceFilterFactoryCriterion[], context: boolean = true, mode: 'every' | 'some') {
    return (event: TraceEventMetadata) => {
        return criteria[mode](({ comparator = 'equals', target, value }) => {
            if (target === 'namespace' && context && isPluginSubscription(event)) {
                return true
            }

            const eventValue = event[target]
            if (typeof eventValue !== 'string') return false

            let result = false
            switch (comparator) {
                case 'equals':
                    result = eventValue === value
                    break
                case 'contains':
                    result = eventValue.includes(value)
                    break
                case 'startsWith':
                    result = eventValue.startsWith(value)
                    break
                case 'endsWith':
                    result = eventValue.endsWith(value)
                    break
                default:
                    result = false
                    break
            }
            return result
        })
    }
}

/**
 * Creates a trace listener from a definition or filter criteria.
 * @param listenerDef The listener definition or filter criteria.
 * @param context Also match the plugin's own context events. Defaults to true.
 * @param filterMode The mode to apply when evaluating multiple filter criteria: 'every' or 'some'.
 * @returns A listener whose handler is the supplied one, or a no-op when none is given.
 */
export function createTraceListener(
    listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
    context: boolean = true,
    filterMode: 'every' | 'some' = 'every'
): TraceListener {
    const { handler = noop, filter } = createTraceFilter(listenerDef, context, filterMode)

    return { filter, handler }
}

function createTraceFilter(
    listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
    context: boolean = true,
    filterMode: 'every' | 'some' = 'every'
): TraceFilterFactoryParam & { filter: TraceFilter } {
    if (Array.isArray(listenerDef)) {
        return { filter: createFilter(listenerDef, context, filterMode) }
    }

    // Copy: the caller's definition must never be mutated.
    return {
        ...listenerDef,
        filter: Array.isArray(listenerDef.filter)
            ? createFilter(listenerDef.filter, context, filterMode)
            : listenerDef.filter
    }
}

function isPluginSubscription(event: TraceEventMetadata): boolean {
    return event?.source === pluginName && (!event?.namespace || event.namespace.startsWith(pluginSubscriptionNamespace))
}