import { printObject } from './print-object'
import type { Store } from 'pinia'

export function printTracePayload(tracePayload: Record<string, unknown>) {
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

                                const value = (arg as Record<string, unknown>)[curr]

                                if (typeof value !== 'function') {
                                    if (!acc['computed']) {
                                        acc['computed'] = []
                                    }
                                    (acc['computed'] as string[]).push(curr)

                                } else {
                                    acc[curr] = (arg as Record<string, unknown>)[curr]
                                }

                                return acc
                            }, {} as Record<string, unknown>)
                        })
                        break;
                    case 'subscribers':
                        printObject(key, (arg as { name: string }[]).map(
                            (item, index) => `${index > 0 ? '\r\n ' : ' '}- ${item.name}`
                        ))
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