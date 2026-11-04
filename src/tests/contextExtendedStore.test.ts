import { describe, expect, it } from 'vitest'
import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, defineAStoreCtx } from 'pinia-plugin-subscription'
import { createTracerRegistry } from 'pinia-plugin-subscription-devtools'
import { ExtendsPiniaStore, ParentStore } from 'pinia-plugin-extending-store'
import { useErrorsStore } from 'pinia-plugin-extending-store/stores'
import { useContactStore } from '../../demo/stores/experiment/contact'

describe('context trace of an extended store', () => {
    it('keeps the context of the demo contact store, whose redaction used to fail', () => {
        const registry = createTracerRegistry({ journal: true, redact: true })
        const pinia = createPinia()
        createApp({}).use(pinia)
        pinia.use(createPlugin([ExtendsPiniaStore as any], { runtimeEnvironment: 'client', tracerHandler: registry.tracerHandler } as any))

        const store: any = useContactStore('newContactStore')
        store.setData({ id: 2, firstname: 'c', email: 'm@m.com' })

        const context = registry.journal!.getEvents('newContactStore').find(event => event.namespace.endsWith(':context'))
        const payload = context?.payload as { store: Record<string, unknown> }

        expect(payload).not.toHaveProperty('__traceRedactionError')
        expect(payload.store).toHaveProperty('setData')
        expect(payload.store).toHaveProperty('addError')
    })

    it('is emitted once parentsStores extended the store, even with a redacted (copied) payload', () => {
        const registry = createTracerRegistry({ journal: true, redact: true })
        const pinia = createPinia()
        createApp({}).use(pinia)
        pinia.use(createPlugin([ExtendsPiniaStore as any], { runtimeEnvironment: 'client', tracerHandler: registry.tracerHandler } as any))

        defineAStoreCtx('extendedContextStore', () => ({ email: ref('a') }), {
            parentsStores: [new ParentStore('parent-errors', useErrorsStore)]
        } as any)()

        const context = registry.journal!.getEvents('extendedContextStore').find(event => event.namespace.endsWith(':context'))
        const payload = context?.payload as { store: Record<string, unknown>, subscribers: Array<{ name: string }> }

        expect(payload.subscribers.map(subscriber => subscriber.name)).toEqual(['pinia-plugin-extending-store'])
        expect(payload.store).toHaveProperty('email')
        expect(payload.store).toHaveProperty('addError')
        expect(payload.store).toHaveProperty('errors')
    })
})
