export const errorColor = '#f86f63'

/**
 * Prints an error to the console with a specific format.
 * @param payload The error object to print.
 */
export function printError(payload: Error) {
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