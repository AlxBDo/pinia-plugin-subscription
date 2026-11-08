import { describe, expect, it } from 'vitest'
import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, defineAStoreCtx } from 'pinia-plugin-subscription'
import { createTracerRegistry } from '../factories/trace-registry'
import { buildContextView, describeSubscribers } from '../utils/traceContext'

import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/types'

class Named {
    private _name: string
    execution = { hydration: 'defer' }
    constructor(name: string) { this._name = name }
    get name() { return this._name }
}

describe('traceContext', () => {
    it('captures subscriber additions in the redacted context despite a throwing getter', () => {
        const registry = createTracerRegistry({ journal: true, redact: true })
        const pinia = createPinia()
        createApp({}).use(pinia)
        const subscriber: PluginSubscriberInterface = {
            name: 'test-extension',
            invoke: ({ store }) => {
                Object.assign(store, { addError: () => {}, errors: [] })
                Object.defineProperty(store, 'unreadable', {
                    enumerable: true,
                    get() { throw new Error('not ready') }
                })
                return true
            }
        }
        pinia.use(createPlugin([subscriber], { runtimeEnvironment: 'client', tracerHandler: registry.tracerHandler }))

        defineAStoreCtx('extendedContextStore', () => ({ email: ref('a') }))()

        const context = registry.journal!.getEvents('extendedContextStore').find(event => event.namespace.endsWith(':context'))
        const payload = context?.payload as { store: Record<string, unknown>, subscribers: Array<{ name: string }> }
        expect(payload).not.toHaveProperty('__traceRedactionError')
        expect(payload.subscribers.map(item => item.name)).toEqual(['test-extension'])
        expect(payload.store).toMatchObject({ email: 'a', errors: [], unreadable: '[Unreadable]' })
        expect(payload.store.addError).toEqual(expect.any(Function))
    })

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
