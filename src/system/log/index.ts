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

export const getStyleDefinition = (bgColor: string, color: string = 'white') =>
    `background-color: ${bgColor}; color: ${color}; padding: 1px; margin-right: 5px; font-size: 12px`