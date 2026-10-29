/**
 * Prints an array to the console with a specific label and group type.
 * @param label The label to display for the array.
 * @param payload The array to print.
 * @param icon An optional icon to display alongside the label.
 */
export function printArray(
    payload: any[],
    label?: string,
    icon: string = ''
) {
    if (typeof payload[0] !== 'object') {
        const printablePayload = (typeof payload[0] === 'string') ? payload.join(', ') : payload
        if (label) {
            console.log(
                '%c%s',
                'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
                `[ ${icon}${label} ]`, printablePayload
            )
        } else {
            console.log(printablePayload)
        }
    }

    if (typeof payload[0] === 'object') {
        if (payload[0]?.name) {
            console.log(payload.reduce((acc, item) => {
                if (acc) { acc += '\r\n' }
                acc += `- ${item.name}`
                return acc
            }, ''))
        } else if (payload[0]?._id) {
            console.log(payload.reduce((acc, item) => {
                if (acc) { acc += '\r\n' }
                acc += `- ${item._id}`
                return acc
            }, ''))
        } else {
            payload.forEach((item: any) => {
                console.dir(item)
            })
        }
    }
}