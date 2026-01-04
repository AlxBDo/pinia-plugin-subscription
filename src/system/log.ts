import { pluginName } from '../utils/constantes'
import type { Console, LogType, StyleDefinition, StyleDefinitions } from '../types/log'


const style = (bgColor: string, color: string = 'white') =>
    `background-color: ${bgColor}; color: ${color}; padding: 1px; margin-right: 5px; font-size: 12px`


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

export abstract class CustomConsole implements Console {
    protected _bgColor: string = '#ffec73'
    protected _color: string = 'green'
    protected _icon: string = '🍍⚡'
    protected _errorBgColor: string = '#d24545'
    protected _errorColor: string = 'white'
    protected _errorIcon: string = '🍍⚠️'
    protected abstract _pluginName: string
    protected _styles: StyleDefinitions = {
        error: { bgColor: this._errorBgColor, color: this._errorColor, icon: this._errorIcon },
        info: { bgColor: this._bgColor, color: this._color, icon: this._icon }
    }

    protected formatMessage(message: string, icon: string): string {
        return ` [${icon} ${pluginName}] - ${message} `
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

    protected rebuildArgs(args: string | any[], icon: string) {
        if (typeof args === 'string') {
            return [this.formatMessage(args, icon)]
        }

        if (Array.isArray(args)) {
            return [this.formatMessage(args.shift(), icon), ...(args ?? [])]
        }
    }

    protected useLog(styleDefinition: StyleDefinition, args: any) {
        log(
            this.generateStyle(styleDefinition),
            this.rebuildArgs(args, styleDefinition.icon)
        )
    }
}

class PluginConsoleClass extends CustomConsole {
    protected _pluginName: string = pluginName
}

export const PluginConsole = new PluginConsoleClass()