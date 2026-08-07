import type { Console } from "../types/log"

export default abstract class Debug {
    protected abstract _className: string
    private _console?: Console
    private _debug: boolean = false

    get console(): Console {
        return this._console ?? console
    }
    set console(customConsole: Console) {
        this._console = customConsole
    }

    get debug(): boolean { return this._debug }
    set debug(debug: boolean) { this._debug = debug }

    constructor(debug: boolean, customConsole?: Console) {
        this._debug = debug
        this._className = this.constructor.name

        if (customConsole) {
            this._console = customConsole
        }
    }


    debugLog(...args: any): void {
        if (this._debug) {
            if (Array.isArray(args)) {
                args[0] = `${this._className} - ${args[0]}`
            }
            this.console.log(...args)
        }
    }

    logError(...args: any): void {
        this.console.error(...args)
    }
}