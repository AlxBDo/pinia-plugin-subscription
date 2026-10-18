import { createConsoleGroupTraceListener } from "./console-trace-listener"
import { pluginName, pluginSubscriptionNamespace } from "../utils/constants"

import type {
    TraceEventMetadata,
    TraceFilter,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceGroupListener
} from "../types/trace"


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
 * Creates a trace group listener with optional filtering.
 * @param listenerDef The listener definition or filter criteria for the trace group listener.
 * @param context Print the plugin context (subscribers, store, options, and traces) to the console.. Defaults to true.
 * @param filterMode The mode to apply when evaluating multiple filter criteria: 'every' or 'some'.
 * @param groupBy The key of the trace event metadata to group by.
 * @returns A trace listener configured with group handling and filtering.
 */
export function createTraceGroupListener(
    listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
    context: boolean = true,
    filterMode: 'every' | 'some' = 'every',
    groupBy: keyof TraceEventMetadata = 'scope'
) {
    return {
        groupBy,
        ...createConsoleGroupTraceListener(groupBy),
        ...createTraceFilter(listenerDef, context, filterMode)
    } as TraceGroupListener

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