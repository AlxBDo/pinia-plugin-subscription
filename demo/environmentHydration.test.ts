import { describe, expect, it, vi } from 'vitest'

import { renderDemo } from './entry-server'
import { createDemoApp } from './app'
import { useVisitorEnvironmentStore } from './stores/visitor-environment'
import {
    createBrowserVisitorSubscriber,
    createServerVisitorSubscriber
} from './plugins/demoPluginEnvironmentHydration'
import { parsePreferredLocale } from './utils/parsePreferredLocale'

import type { PiniaPluginContext } from 'pinia'
import type { Tracer } from 'pinia-plugin-subscription/helpers'
import type { VisitorBrowserData, VisitorServerData } from './types/plugin'

const browserData: VisitorBrowserData = {
    colorScheme: 'dark',
    timezone: 'Europe/Paris',
    viewport: '1280 × 720'
}

describe('environment-aware hydration demo', () => {
    it('hydrates the server part only and leaves the browser part to the client', async () => {
        const { html, state } = await renderDemo('/request-a', { acceptLanguage: 'fr-FR,fr;q=0.9' })
        const visitor = state.visitorEnvironmentStore

        expect(visitor.server).toMatchObject({ locale: 'fr-FR', pathname: '/request-a' })
        expect(visitor.browser).toBeNull()
        expect(visitor.steps.map((step: { environment: string }) => step.environment)).toEqual(['server'])
        expect(html).toContain('fr-FR')
        expect(html).toContain('/request-a')
        expect(html).toContain('Waiting for the browser')
    })

    it('keeps the data of each request isolated', async () => {
        const [first, second] = await Promise.all([
            renderDemo('/request-a', { acceptLanguage: 'fr' }),
            renderDemo('/request-b', { acceptLanguage: 'de' })
        ])

        expect(first.state.visitorEnvironmentStore.server).toMatchObject({ locale: 'fr', pathname: '/request-a' })
        expect(second.state.visitorEnvironmentStore.server).toMatchObject({ locale: 'de', pathname: '/request-b' })
    })

    it('does not serialize a malformed Accept-Language header', async () => {
        const { html, state } = await renderDemo('/', { acceptLanguage: '<script>alert(1)</script>' })

        expect(state.visitorEnvironmentStore.server.locale).toBe('en')
        expect(html).not.toContain('<script>alert')
    })

    it('waits for the asynchronous server data before the store is ready', async () => {
        let resolveData!: (data: VisitorServerData) => void
        const { ready, subscriber } = createServerVisitorSubscriber(
            () => new Promise<VisitorServerData>((resolve) => { resolveData = resolve })
        )
        const { pinia } = createDemoApp('server', undefined, [subscriber])
        const store = useVisitorEnvironmentStore(pinia)

        expect(store.server).toBeNull()

        resolveData({ locale: 'en', pathname: '/', renderedAt: '2026-01-01T00:00:00.000Z' })
        await ready

        expect(store.server).toMatchObject({ pathname: '/' })
    })

    it('rejects readiness when the server data cannot be loaded', async () => {
        const error = new Error('server data unavailable')
        const { ready, subscriber } = createServerVisitorSubscriber(() => Promise.reject(error))
        const { pinia } = createDemoApp('server', undefined, [subscriber])

        useVisitorEnvironmentStore(pinia)

        await expect(ready).rejects.toBe(error)
    })

    it('fills the browser part after hydration and keeps the server part from the payload', async () => {
        const { state } = await renderDemo('/request-a', { acceptLanguage: 'fr' })
        const serverPayload = JSON.parse(JSON.stringify(state))
        const { pinia } = createDemoApp('client', serverPayload, [createBrowserVisitorSubscriber(() => browserData)])
        const store = useVisitorEnvironmentStore(pinia)

        expect(store.server?.pathname).toBe('/request-a')
        expect(store.browser).toBeNull()

        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(store.browser).toEqual(browserData)
        expect(store.steps.map((step) => step.environment)).toEqual(['server', 'client'])
    })
})

describe('environment-aware hydration traces', () => {
    const storeContext = (patch = vi.fn()) => ({
        store: { $id: 'visitorEnvironmentStore', $patch: patch },
        options: { storeOptions: { demoEnvironmentHydration: true } }
    }) as unknown as PiniaPluginContext
    const stubTracerFactory = () => {
        const tracer = { debug: vi.fn(), error: vi.fn() }
        return { tracer, createTracer: vi.fn(() => tracer as unknown as Tracer) }
    }
    const namespaces = (calls: unknown[][]) => calls.map((call) => call[1])

    it('traces the server subscriber lifecycle with the store as scope', async () => {
        const { tracer, createTracer } = stubTracerFactory()
        const { subscriber } = createServerVisitorSubscriber(async () => ({
            locale: 'fr', pathname: '/', renderedAt: '2026-01-01T00:00:00.000Z'
        }))
        const context = storeContext()

        expect(subscriber.invoke(context, createTracer)).toBe(true)
        await subscriber.hydrate?.(context)

        expect(createTracer).toHaveBeenCalledWith('demo-plugin-server-visitor')
        expect(namespaces(tracer.debug.mock.calls).slice(-2)).toEqual([
            'visitorenvironmentstore:server:hydrate:start',
            'visitorenvironmentstore:server:hydrate:done'
        ])
        expect(tracer.debug.mock.calls.every((call) => call[3] === 'visitorEnvironmentStore')).toBe(true)
        expect(tracer.error).not.toHaveBeenCalled()
    })

    it('traces a failing server hydration as an error', async () => {
        const { tracer, createTracer } = stubTracerFactory()
        const error = new Error('server data unavailable')
        const { ready, subscriber } = createServerVisitorSubscriber(() => Promise.reject(error))
        const context = storeContext()
        ready.catch(() => undefined)

        subscriber.invoke(context, createTracer)
        await expect(subscriber.hydrate?.(context)).rejects.toBe(error)

        expect(tracer.error).toHaveBeenCalledWith(
            'VisitorEnvironmentStore:server:hydrate',
            'visitorenvironmentstore:server:hydrate',
            error,
            undefined,
            'visitorEnvironmentStore'
        )
    })

    it('traces the browser subscriber lifecycle', () => {
        const { tracer, createTracer } = stubTracerFactory()
        const subscriber = createBrowserVisitorSubscriber(() => browserData)
        const context = storeContext()

        subscriber.invoke(context, createTracer)
        subscriber.hydrate?.(context)

        expect(createTracer).toHaveBeenCalledWith('demo-plugin-browser-visitor')
        expect(namespaces(tracer.debug.mock.calls).slice(-2)).toEqual([
            'visitorenvironmentstore:browser:hydrate:start',
            'visitorenvironmentstore:browser:hydrate:done'
        ])
    })

    it('traces mutations in the store mutation group', () => {
        const { tracer, createTracer } = stubTracerFactory()
        const subscriber = createBrowserVisitorSubscriber(() => browserData)

        subscriber.invoke(storeContext(), createTracer)
        subscriber.storeMutationSubscription?.({} as never)?.callback({} as never, {} as never)

        const mutationCall = tracer.debug.mock.calls.find((call) => call[1] === 'visitorenvironmentstore:onmutation')
        const payload = (mutationCall?.[2] as () => { groupId: string })()

        expect(payload.groupId).toBe('store:onMutation:visitorEnvironmentStore')
    })


    it('does not create a tracer for stores that did not opt in', () => {
        const { createTracer } = stubTracerFactory()
        const { subscriber } = createServerVisitorSubscriber(async () => {
            throw new Error('not expected')
        })

        expect(subscriber.invoke({
            store: { $id: 'otherStore' },
            options: { storeOptions: {} }
        } as unknown as PiniaPluginContext, createTracer)).toBe(false)
        expect(createTracer).not.toHaveBeenCalled()
    })

    it('still hydrates when tracing is not connected', async () => {
        const { subscriber } = createServerVisitorSubscriber(async () => ({
            locale: 'en', pathname: '/', renderedAt: '2026-01-01T00:00:00.000Z'
        }))
        const patch = vi.fn()
        const context = storeContext(patch)

        expect(subscriber.invoke(context)).toBe(true)
        await subscriber.hydrate?.(context)

        expect(patch).toHaveBeenCalledOnce()
    })
})

describe('parsePreferredLocale', () => {
    it.each([
        ['fr-FR,fr;q=0.9,en;q=0.8', 'fr-FR'],
        ['en-US', 'en-US'],
        ['', 'en'],
        [undefined, 'en'],
        ['*', 'en'],
        ['x'.repeat(500), 'en']
    ])('parses %s as %s', (header, expected) => {
        expect(parsePreferredLocale(header)).toBe(expected)
    })
})
