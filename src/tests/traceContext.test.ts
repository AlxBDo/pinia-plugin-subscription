import { describe, expect, it } from 'vitest'
import { buildContextView, describeSubscribers } from '../utils/traceContext'

class Named {
    private _name: string
    execution = { hydration: 'defer' }
    constructor(name: string) { this._name = name }
    get name() { return this._name }
}

describe('traceContext', () => {
    it('describes subscribers by name, keeping their execution options', () => {
        const described = describeSubscribers([new Named('persist'), new Named('persist'), {}])

        expect(Object.keys(described)).toEqual(['persist', 'persist (2)', 'anonymous'])
        expect(described.persist).toEqual({ execution: { hydration: 'defer' } })
    })

    it('shows the store options without their actions', () => {
        const view = buildContextView({
            options: { actions: { add: () => { } }, state: () => ({}) },
            subscribers: [new Named('persist')]
        })

        expect(view.options).toEqual({ state: expect.any(Function) })
        expect(Object.keys(view.subscribers as object)).toEqual(['persist'])
    })

    it('prefers the plugin storeOptions, like the console', () => {
        const view = buildContextView({ options: { actions: {}, storeOptions: { actions: {}, persist: true } } })

        expect(view.options).toEqual({ persist: true })
    })
})
