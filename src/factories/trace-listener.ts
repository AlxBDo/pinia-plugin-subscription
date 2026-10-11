import { createConsoleTraceListener, createConsoleGroupTraceListener } from "./console-trace-listener"
import type {
    ConsoleTraceGroupListener,
    TraceEventMetadata,
    TraceFilterFactoryCriterion,
    TraceFilterFactoryParam,
    TraceGroupListener,
    TraceListener
} from "../types/trace"


function createFilter(criteria: TraceFilterFactoryCriterion[], mode: 'every' | 'some') {
    return (event: TraceEventMetadata) => {
        return criteria[mode](({ comparator = 'equals', target, value }) => {
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
 * @param filterDef The filter criteria for the trace events.
 * @param filterMode The mode to apply when evaluating multiple filter criteria: 'every' or 'some'.
 * @param groupBy The key of the trace event metadata to group by.
 * @returns A trace listener configured with group handling and filtering.
 */
export function createTraceGroupListener(
    filterDef: TraceFilterFactoryCriterion[],
    filterMode: 'every' | 'some' = 'every',
    groupBy: keyof TraceEventMetadata = 'scope'
) {
    return {
        groupBy,
        ...createConsoleGroupTraceListener(groupBy),
        ...createTraceFilter(filterDef, filterMode)
    } as TraceGroupListener

}

function createTraceFilter(
    listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[],
    filterMode: 'every' | 'some' = 'every'
) {
    if (Array.isArray(listenerDef)) {
        listenerDef = {
            filter: createFilter(listenerDef, filterMode)
        }
    }

    if (listenerDef.filter && Array.isArray(listenerDef.filter)) {
        listenerDef.filter = createFilter(listenerDef.filter, filterMode)
    }

    if (!listenerDef.filter || typeof listenerDef.filter !== 'function') {
        listenerDef = { ...listenerDef, filter: () => true }
    }

    return listenerDef
}

/**
 * Creates a trace listener with optional filtering.
 * @param param The trace listener parameters including handler and optional filter criteria.
 * @param filterMode The mode to apply when evaluating multiple filter criteria: 'every' or 'some'.
 * @returns A trace listener configured with the specified handler and filter.
 */
export function createTraceListener(listenerDef: TraceFilterFactoryParam | TraceFilterFactoryCriterion[], filterMode: 'every' | 'some' = 'every'): TraceListener {
    listenerDef = createTraceFilter(listenerDef, filterMode)

    if (!listenerDef?.handler) {
        listenerDef = { ...listenerDef, ...createConsoleTraceListener() } as TraceFilterFactoryParam
    }

    return listenerDef as TraceListener
}