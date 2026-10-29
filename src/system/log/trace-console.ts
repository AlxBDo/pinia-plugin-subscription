import { CustomConsole } from './console'
import { logTrace } from './log-trace'
import { pluginName } from '../../utils/constants'
import { printTrace } from './print-trace'
import { printTracePayload } from './print-trace-payload'
import type { StyleDefinition } from '../../types/log'
import type { ConsoleTraceEvent, ConsoleTraceEventArgs, TraceEvent } from '../../types/trace'

export class TraceConsole extends CustomConsole {
    protected _pluginName: string = pluginName

    constructor(pluginName?: string) {
        super()
        if (pluginName) {
            this._pluginName = pluginName
        }
    }


    logGroup(groups: ConsoleTraceEvent[]) {
        const firstEntry = groups.shift()
        const context = firstEntry?.[1] as ConsoleTraceEventArgs

        console.groupCollapsed(
            '%c%s',
            'color: #87e47f; padding: 1px; margin-right: 5px; font-size: 11px; font-family: arial',
            `🍍 ${context?.label ?? context?.namespace}`, `[${context?.scope}]`
        )
        if (context?.payload) {
            printTracePayload(context.payload)
        }
        console.groupCollapsed(
            '%c%s',
            'color: #f1f6b7; padding: 1px; margin-right: 5px; font-size: 11px',
            `[ ✨ traces ]`
        )
        groups.forEach(group => printTrace(group[1] as TraceEvent))
        console.groupEnd()
        console.groupEnd()
    }

    protected useLog(styleDefinition: StyleDefinition, args: any) {
        logTrace(
            this.generateStyle(styleDefinition),
            this.rebuildArgs(args),
            this._pluginName
        )
    }
}