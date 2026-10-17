import { TraceConsole } from '../system/log'

import type { Console } from '../types/log'
import type {
    ConsoleTraceEvent, ConsoleTraceEventArgs, TraceEvent, TraceListenerGroupBy, ConsoleTraceGroupListener
} from '../types/trace'


/**
 * Builds the console arguments from a trace event.
 * @param event The trace event to build console arguments from.
 * @returns An array containing the formatted trace label and the sanitized event data.
 */
function buildConsoleArgsFromEvent(event: TraceEvent): ConsoleTraceEvent {
    const sanitizedEvent = Object.keys(event).reduce((acc, curr) => {
        if (curr !== 'level' && curr !== 'timestamp') {
            acc[curr] = event[curr as keyof ConsoleTraceEventArgs]
        }
        return acc
    }, {} as Record<string, unknown>)

    return [formatTraceLabel(event), sanitizedEvent as ConsoleTraceEventArgs]
}

function formatTraceLabel(event: TraceEvent): string {
    return event.scope
        ? `${event.label} [${event.scope}]`
        : `${event.label}`
}

function log(target: Console, event: TraceEvent): void {
    const consoleMethod = event.level === 'error' ? 'error' : 'log'
    target[consoleMethod](...buildConsoleArgsFromEvent(event))
}

/**
 * Creates a console trace group listener that groups trace events by the specified key.
 * @param groupBy The key of the trace event metadata to group by.
 * @returns A console trace group listener configured to group trace events by the specified key.
 */
export function createConsoleGroupTraceListener(groupBy: TraceListenerGroupBy = 'scope'): ConsoleTraceGroupListener {
    const target = new TraceConsole()
    const groups = new Map<string, ConsoleTraceEvent[]>()


    function createGroup(key: string) {
        groups.set(key, [])
    }

    function logGroup(key: string): void {
        const group = groups.get(key)

        if (!group) {
            target.error(`No group found for key "${key}"`)
            return
        }

        if (group.length) { target.logGroup(group) }

        groups.delete(key)
    }

    return {
        createGroup,
        logGroup,
        handler(event): void {
            const groupKey = event[groupBy] as string
            if (!groups.has(groupKey)) {
                log(target, event)
                return
            }

            groups.get(groupKey)?.push(buildConsoleArgsFromEvent(event))
        }
    }
}


