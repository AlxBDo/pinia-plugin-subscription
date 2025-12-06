import { log } from "./log"

export default class Performance {
    public duration: number = 0
    public endTime: number = 0
    public name: string
    public startTime: number = 0

    constructor(name: string) {
        this.name = name
        this.startTime = performance.now()
    }

    getStyle(): string {
        let backgroundColor: string
        if (this.duration < 5) {
            backgroundColor = '#4CAF50'
        } else if (this.duration < 25) {
            backgroundColor = '#2196F3'
        } else if (this.duration < 100) {
            backgroundColor = '#ff9800'
        } else {
            backgroundColor = '#f44336'
        }

        return `color: white; background-color: ${backgroundColor}; padding: 2px 4px; border-radius: 2px;`
    }

    stop() {
        this.endTime = performance.now()
        this.duration = this.endTime - this.startTime
        this.duration && log(`Performance measurement:`, this.getStyle(), [this.name, `${this.duration}ms`])
    }
}