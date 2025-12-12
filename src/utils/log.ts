const pluginName = 'pinia-plugin-subscription'

interface IStyleOptions {
    bgColor: string;
    color?: string;
    icon?: string;
}

const style = (bgColor: string, color: string = 'white') =>
    `background-color: ${bgColor}; color: ${color}; padding: 1px; margin-right: 5px; font-size: 12px`


export function log(message: string, logStyle: string, args?: any | any[]) {
    if (!logStyle) {
        throw new Error('Style instructions are required')
    }

    console.log(
        '%c%s',
        logStyle,
        message,
        args
    )
}

export function eppsLog(message: string, args?: any | any[], styleOptions?: IStyleOptions) {
    const logStyle = styleOptions ? style(styleOptions.bgColor, styleOptions.color) : style('#ffec73', 'green')
    const icon = styleOptions?.icon ?? '🍍⚡'

    message = ` [${icon} ${pluginName} plugin] - ${message} `

    log(
        message,
        logStyle,
        args
    )
}

export function eppsLogError(message: string, args?: any | any[]) {
    eppsLog(message, args, { bgColor: '#d24545', color: 'white', icon: '🍍⚠️' })
}