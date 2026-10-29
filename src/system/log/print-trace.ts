import { isRef } from 'vue'
import { printObject } from './print-object'
import type { TraceEvent } from '../../types/trace'


function getPrintablePayload(trace: TraceEvent) {
    const { payload } = trace
    if (payload && Object.keys(payload).length > 0) {
        return Object.keys(payload).reduce((acc, key) => {
            if (!['groupId', 'label', 'namespace', 'scope', 'source'].includes(key)) {
                acc[key] = isRef(payload[key]) ? payload[key].value : payload[key]
            }
            return acc
        }, {} as Record<string, unknown>)
    }
    return undefined
}


/**
 * Prints a trace event to the console.
 * If the trace has a payload, it will be printed as an object.
 * Otherwise, it will print the trace label and source.
 * @param trace The trace event to print.
 * @returns void
 */
export function printTrace(trace: TraceEvent) {
    const payload = getPrintablePayload(trace)
    if (payload && Object.keys(payload).length > 0) {
        printObject(trace.label, payload, 'collapsed', trace.source)
        return
    }
    console.log(
        '%c%s',
        'color: #f8f89f; padding: 1px; margin-right: 5px; font-size: 11px',
        trace.label, trace.source,
    )
}