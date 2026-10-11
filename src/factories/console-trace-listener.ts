import { PluginConsole, TraceConsole } from '../system/log'

import type { Console } from '../types/log'
import type {
    ConsoleTraceEvent, ConsoleTraceEventArgs, TraceEvent, TraceListenerGroupBy, ConsoleTraceGroupListener, TraceListener
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

    /**
     if (event.error !== undefined) {
        args.push(event.error)
    }

    if (event.payload !== undefined) {
        if (Array.isArray(event.payload)) {
            args.push(...event.payload)
        } else {
            args.push(event.payload)
        }
    }
        */
}

function formatTraceLabel(event: TraceEvent): string {
    return event.scope
        ? `${event.label} [${event.scope}]`
        : `${event.label}`
}

/**
 * Creates an opt-in trace listener that reproduces the former console output.
 */
export function createConsoleTraceListener(target?: Console): Omit<TraceListener, 'filter'> {
    if (!target) {
        target = new TraceConsole()
    }

    return {
        handler(event): void {
            const consoleMethod = event.level === 'error' ? 'error' : 'log'
            target[consoleMethod](...buildConsoleArgsFromEvent(event))
        }
    }
}


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

        if (group.length) { target.logGroup(`[ ${groupBy} ] ${key}`, group) }

        //groups.delete(key)
    }

    return {
        createGroup,
        logGroup,
        handler(event): void {
            const groupKey = event[groupBy] as string
            if (!groups.has(groupKey)) {
                target.error(`No group found for key "${groupKey}"`)
                return
            }

            groups.get(groupKey)?.push(buildConsoleArgsFromEvent(event))
        }
    }
}


