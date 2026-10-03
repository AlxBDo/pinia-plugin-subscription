import { PluginConsole } from './log'

import type { Console } from '../types/log'
import type { TraceEvent, TraceListener } from '../types/trace'

function formatTraceLabel(event: TraceEvent): string {
    return event.scope
        ? `${event.source} - ${event.namespace} [${event.scope}]`
        : `${event.source} - ${event.namespace}`
}

/**
 * Creates an opt-in trace listener that reproduces the former console output.
 */
export function createConsoleTraceListener(target: Console = PluginConsole): TraceListener {
    return {
        handler(event): void {
            const args: unknown[] = [formatTraceLabel(event)]

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

            if (event.level === 'error') {
                target.error(...args)
                return
            }

            target.log(...args)
        }
    }
}
