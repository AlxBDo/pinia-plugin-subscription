import { isRef } from 'vue'
import { consoleGroup } from './console-group'
import { printArray } from './print-array'
import { errorColor, printError } from './print-error'


export function printObject(label: string, payload: object, groupType: 'collapsed' | 'expanded' | 'none' = 'collapsed', source?: string) {
    if (payload instanceof Error) {
        printError(payload)
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
        environment: '🍃 ',
        options: '🧮 ',
        store: '🏬 ',
        subscribers: '🧩 ',
        'hooks subscriptions': '🔗 '
    }
    const icon = styles[label] ?? ''

    let consoleGroupArgs = source ? [`${icon}${label}`, source] : [`[ ${icon}${label} ]`]
    consoleGroup(groupType, ...consoleGroupArgs)

    if (isArray) {
        printArray(payload, groupType === 'none' ? label : undefined, icon)
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
                        printObject(key, value, 'expanded')
                    } else if (typeof value[0] === 'string') {
                        printObject(
                            key,
                            value.map((item: string, index: number) => `${index > 0 ? '\r\n ' : ' '}- ${item}`),
                            'expanded'
                        )
                    } else {
                        console.log(
                            '%c%s',
                            'color: #cae38f; padding: 1px; margin-right: 5px; font-size: 10px',
                            `[ ${key} ]`, isRef(value) ? value.value : value
                        )
                    }
                } else if (value instanceof Error) {
                    console.log(key, { name: value.name, message: value.message, stack: value.stack })
                } else {
                    if (isRef(value)) {
                        console.log(
                            '%c%s',
                            'color: #cae38f; padding: 1px; margin-right: 5px; font-size: 10px',
                            `[ ${key} ]`, isRef(value) ? value.value : value
                        )
                    }
                    printObject(key, Object.assign({}, value), 'expanded')
                }
            } else {
                if (!value) {
                    emptyKeys.push(key)
                } else {
                    const typeOfValue = typeof value
                    console.log(
                        '%c%s',
                        'color: #b0fa05; padding: 1px; margin-right: 5px; font-size: 10px',
                        `[ ${key} ]`, typeOfValue === 'function' ? typeOfValue : value
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