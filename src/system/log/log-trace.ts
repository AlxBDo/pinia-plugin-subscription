import { printTracePayload } from './print-trace-payload'

/**
 * Logs trace events to the console with a specific style.
 * @param logStyle - The CSS style string for the log.
 * @param args - The arguments to log, with the first argument being the label.
 * @param pluginName - The name of the plugin generating the log.
 * @returns void
 */
export function logTrace(logStyle: string, args: any, pluginName: string) {
    if (!logStyle) {
        throw new Error('Style instructions are required')
    }

    const label = args.shift()
    const event = args[0]


    if (!event?.payload || Object.keys(event.payload).length === 0) {
        console.log(
            '%c%s',
            logStyle,
            `${event?.source === pluginName ? (event?.label ?? event?.namespace) : label}`,
            event?.source
        )
        return
    }

    console.groupCollapsed(
        '%c%s',
        logStyle,
        `${label}
`, event?.source
    )

    args.forEach((arg: any) => {
        switch (typeof arg) {
            case 'string':
                console.info(arg)
                break;
            case 'object':
                if (Array.isArray(arg)) {
                    console.table(arg)
                } else {
                    printTracePayload(arg)
                }
                break;
            case 'function':
                console.dir(arg)
                break;
            default:
                console.info(arg)
        }
    })



    console.groupEnd()
}