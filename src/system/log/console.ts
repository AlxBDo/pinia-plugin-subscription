import { getStyleDefinition, log } from './index'
import type { Console, LogType, StyleDefinition, StyleDefinitions } from '../../types/log'


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
        return getStyleDefinition(styleDefinition.bgColor, styleDefinition.color)
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