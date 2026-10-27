import { pluginName } from '../utils/constants'
import type { Console, LogType, StyleDefinition, StyleDefinitions } from '../types/log'
import type { ConsoleTraceEvent, ConsoleTraceEventArgs, TraceEvent } from '../types/trace'
import type { Store } from 'pinia'


const errorColor = '#f86f63'
const style = (bgColor: string, color: string = 'white') =>
    `background-color: ${bgColor}; color: ${color}; padding: 1px; margin-right: 5px; font-size: 12px`

function getPrintablePayload(trace: TraceEvent) {
    const { payload } = trace
    if (payload && Object.keys(payload).length > 0) {
        return Object.keys(payload).reduce((acc, key) => {
            if (!['groupId', 'label', 'namespace', 'scope', 'source'].includes(key)) {
                acc[key] = payload[key]
            }
            return acc
        }, {} as Record<string, unknown>)
    }
    return undefined
}

export function printObject(label: string, payload: object, groupCollapsed: boolean = true, source?: string) {
    if (payload instanceof Error) {
        console.groupCollapsed(
            '%c%s',
            `color: ${errorColor}; padding: 1px; margin-right: 5px; font-size: 11px`,
            `[ ${payload.name} ] ${payload.message}`,
        )
        if (payload.cause) {
            console.log('cause:', payload.cause)
        }
        const stack = payload.stack?.split('\n')
        if (stack) {
            stack.forEach(line => {
                const trace = line.split('@')
                if (Array.isArray(trace)) {
                    console.log(trace[0], trace[1])
                }
            })
        }
        console.groupEnd()
    }

    const isArray = Array.isArray(payload)
    const isEmpty = isArray ? payload.length === 0 : Object.keys(payload).length === 0
    if (isEmpty) {
        console.log(
            '%c%s',
            `color: ${errorColor}; padding: 1px; margin-right: 5px; font-size: 10px`,
            `[ ${label} ] Empty`
        )
        return
    }

    const styles: Record<string, string> = {
        options: '📚 ',
        store: '🏪 ',
        subscribers: '🧩 ',
        'hooks subscriptions': '🔗 '
    }
    const icon = styles[label] ?? ''

    if (groupCollapsed) {
        if (source) {
            console.groupCollapsed(
                '%c%s',
                'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
                `${icon} ${label}`, source)
        } else {
            console.groupCollapsed(
                '%c%s',
                'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
                `[ ${icon}${label} ]`)
        }
    } else {
        console.group(
            '%c%s',
            'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
            `[ ${icon} ${label} ]`)
    }

    if (Array.isArray(payload)) {
        if (typeof payload[0] === 'object') {
            payload.forEach((item: any) => {
                if (item.name) {
                    printObject(item.name, item)
                } else if (item._id) {
                    printObject(item._id, item)
                } else {
                    console.dir(item)
                }
            })
        } else {
            payload.forEach((item: any, index: number) => {
                console.log(
                    '%c%s',
                    'color: #cae38f; padding: 1px; margin-right: 5px; font-size: 10px',
                    `[ ${index} ]`, item
                )
            })
        }
    } else {
        let emptyKeys: string[] = []
        Object.keys(payload).forEach(key => {
            if (key === 'groupId') {
                return
            }

            const value = (payload as Record<string, unknown>)[key]
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    if (typeof value[0] === 'object') {
                        printObject(key, value, false)
                    } else {
                        console.group(key)
                        console.log(value)
                        console.groupEnd()
                    }
                } else if (value instanceof Error) {
                    console.log(key, { name: value.name, message: value.message, stack: value.stack })
                } else {
                    printObject(key, Object.assign({}, value), false)
                }
            } else {
                if (!value) {
                    emptyKeys.push(key)
                } else {
                    console.log(
                        '%c%s',
                        'color: #b0fa05; padding: 1px; margin-right: 5px; font-size: 10px',
                        `[ ${key} ]`, value
                    )
                }
            }
        })
        if (emptyKeys.length) {
            console.log(
                '%c%s',
                'color: #f86f63; font-size: 9px',
                `[ Empty properties ]`, emptyKeys
            )
        }
    }
    console.groupEnd()
}

function printTrace(trace: TraceEvent) {
    const payload = getPrintablePayload(trace)
    if (payload && Object.keys(payload).length > 0) {
        printObject(trace.label, payload, true, trace.source)
        return
    }
    console.log(
        '%c%s',
        'color: #f8f89f; padding: 1px; margin-right: 5px; font-size: 11px',
        trace.label, trace.source,
    )
}

function printTracePayload(tracePayload: Record<string, unknown>) {
    Object.keys(tracePayload).forEach((key: string) => {
        if (['groupId', 'label', 'namespace', 'scope', 'source'].includes(key)) {
            return
        }
        const arg = tracePayload[key]
        if (!arg) {
            console.log(
                '%c%s',
                'color: #f86f63; padding: 1px; margin-right: 5px; font-size: 10px',
                `[ ${key} ] ${arg}`
            )
            return
        }

        switch (typeof arg) {
            case 'string': case 'number':
                console.log(
                    '%c%s',
                    'color: #fafa05; padding: 1px; margin-right: 5px; font-size: 10px',
                    `[ ${key} ]`, arg
                )
                break;
            case 'object':
                switch (key) {
                    case 'mutation':
                        console.groupCollapsed('[mutation]')
                        console.dir(arg)
                        console.groupEnd()
                        break;
                    case 'options':
                        printObject(key, (arg as { storeOptions?: unknown })?.storeOptions ?? arg)
                        break;
                    case 'payload':
                        printTracePayload(arg as Record<string, unknown>)
                        break;
                    case 'store':
                        printObject(key, {
                            $state: (arg as Store)['$state'],
                            $actions: Object.keys(arg).reduce((acc, curr) => {
                                if ((curr.startsWith('$') && !['$id', '$state'].includes(curr)) || curr.startsWith('_')) {
                                    return acc
                                }

                                acc[curr] = (arg as Record<string, unknown>)[curr]
                                return acc
                            }, {} as Record<string, unknown>)
                        })
                        break;
                    default:
                        printObject(key, arg)
                }
                break;
            case 'function':
                console.dir(arg)
                break;
            default:
                console.info(key, arg)
        }
    })
}
export function log(logStyle: string, args: any) {
    if (!logStyle) {
        throw new Error('Style instructions are required')
    }

    console.log(
        '%c%s',
        logStyle,
        args.shift(),
        ...args
    )
}


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

export abstract class CustomConsole implements Console {
    protected _bgColor: string = 'transparent'
    protected _color: string = '#f2f286'
    protected _icon: string = '🍍⚡'
    protected _errorBgColor: string = '#d24545'
    protected _errorColor: string = 'white'
    protected _errorIcon: string = '🍍⚠️'
    protected _pluginName?: string
    protected _styles: StyleDefinitions = {
        error: { bgColor: this._errorBgColor, color: this._errorColor, icon: this._errorIcon },
        info: { bgColor: this._bgColor, color: this._color, icon: this._icon }
    }

    protected formatMessage(message: string, icon: string): string {
        return this._pluginName ? ` [${icon} ${this._pluginName}] 
 ${message} 
` : message
    }

    protected generateStyle(styleDefinition: StyleDefinition): string {
        return style(styleDefinition.bgColor, styleDefinition.color)
    }

    protected getStyleDefinition(messageType?: LogType): StyleDefinition {
        return this._styles[messageType ?? 'info']
    }

    log(...args: any) {
        this.useLog(
            this.getStyleDefinition(),
            args
        )
    }

    error(...args: any) {
        const logType = 'error'
        this.useLog(
            this.getStyleDefinition(logType),
            args
        )
    }

    protected rebuildArgs(args: string | any[]): any[] {
        if (typeof args === 'string') {
            return [args]
        }

        if (Array.isArray(args)) {
            return [args.shift(), ...args]
        }

        return [args]
    }

    protected useLog(styleDefinition: StyleDefinition, args: any) {
        log(
            this.generateStyle(styleDefinition),
            this.rebuildArgs(args)
        )
    }
}

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