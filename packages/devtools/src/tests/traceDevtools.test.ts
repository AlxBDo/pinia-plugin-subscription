// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createTracerRegistry } from '../factories/trace-registry'
import { mountTraceDevtools } from '../panel/mount'

const hostId = 'pinia-plugin-subscription-devtools'
const shadow = () => document.getElementById(hostId)!.shadowRoot!
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 40)); await nextTick() }

afterEach(() => { document.body.innerHTML = '' })

describe('mountTraceDevtools', () => {
    it('warns and does nothing without a journal', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { })

        mountTraceDevtools(createTracerRegistry()).toggle()

        expect(warn).toHaveBeenCalled()
        expect(document.getElementById(hostId)).toBeNull()
        warn.mockRestore()
    })

    it('shows object keys in the collapsed summary instead of their count', async () => {
        const registry = createTracerRegistry({ journal: true })
        registry.tracerHandler.createTracer('Store').debug('PluginSubscription:context', 'pluginsubscription:context', { subscribers: [], store: {}, options: {} }, 'cart')
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        Array.from(shadow().querySelectorAll('button')).find(b => b.textContent === 'Context')!.click()
        await flush()
        expect(shadow().textContent).toContain('{ subscribers, store, options }')
        expect(shadow().textContent).not.toMatch(/\{\d+\}/)
        handle.destroy?.()
    })

    it.each(['live', 'imported'] as const)('shows nested parent store rename options in %s context without exposing redacted values', async source => {
        const traced = createTracerRegistry({ journal: true, redact: true, side: 'server' })
        traced.tracerHandler.createTracer('Store').debug('PluginSubscription:context', 'pluginsubscription:context', {
            options: {
                storeOptions: {
                    parentsStores: [{
                        id: 'listsCollection',
                        options: {
                            actionsToRename: { add: 'addList' },
                            propertiesToRename: { items: 'lists', token: 'secret' }
                        }
                    }]
                }
            }
        }, 'lists')
        const registry = source === 'live' ? traced : createTracerRegistry({ journal: true, side: 'client' })
        if (source === 'imported') { registry.journal!.import(JSON.parse(JSON.stringify(traced.journal!.serialize()))) }
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        Array.from(shadow().querySelectorAll('button')).find(b => b.textContent === 'Context')!.click()
        await flush()

        expect(shadow().textContent).toContain('actionsToRename: { add }')
        expect(shadow().textContent).toContain('addList')
        expect(shadow().textContent).toContain('propertiesToRename: { items, token }')
        expect(shadow().textContent).toContain('items: lists')
        expect(shadow().textContent).toContain('[REDACTED]')
        expect(shadow().textContent).not.toContain('secret')
        handle.unmount()
    })

    it('re-reads the live store on each render, so members added after the context event show up', async () => {
        const registry = createTracerRegistry({ journal: true })
        const tracer = registry.tracerHandler.createTracer('Store')
        const store: Record<string, unknown> = { $id: 'cart' }
        tracer.debug('PluginSubscription:context', 'pluginsubscription:context', { store }, 'cart')
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        Array.from(shadow().querySelectorAll('button')).find(b => b.textContent === 'Context')!.click()
        await flush()
        expect(shadow().textContent).not.toContain('inheritedAction')

        store.inheritedAction = () => { }
        tracer.debug('Extended', 'ns', undefined, 'cart')
        await flush()
        expect(shadow().textContent).toContain('inheritedAction')
        handle.destroy?.()
    })

    it('renders an isolated panel, grouped by lifecycle, with live updates', async () => {
        const registry = createTracerRegistry({ journal: true })
        const tracer = registry.tracerHandler.createTracer('Store')
        const groupId = 'cart/onAction:add#1'
        tracer.debug('PluginSubscription:context', 'pluginsubscription:context', { subscribers: ['sub'] }, 'cart')
        registry.tracerHandler.startGroup({ groupId, scope: 'cart' } as never)
        tracer.debug('Start', 'ns', { args: [1], groupId }, 'cart')
        tracer.debug('Inside', 'ns', undefined, 'cart')
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        expect(shadow().querySelector('aside')).not.toBeNull()
        expect(shadow().textContent).toContain('onAction \u00b7 add')
        expect(shadow().querySelector('aside')!.textContent).not.toContain('#1')
        expect(document.body.querySelector('aside')).toBeNull()
        expect(shadow().querySelectorAll('.pps-chip.p')).toHaveLength(0)

        Array.from(shadow().querySelectorAll('button')).find(b => b.textContent?.includes('onAction'))!.click()
        await flush()
        expect(shadow().querySelectorAll('.pps-chip.p')).toHaveLength(1)
        expect(shadow().querySelectorAll('.pps-chip.e')).toHaveLength(0)

        vi.spyOn(console, 'error').mockImplementation(() => { })
        tracer.error('Failed', 'ns', new Error('x'), undefined, 'cart')
        registry.tracerHandler.closeGroup({ groupId, scope: 'cart' } as never)
        await flush()
        expect(shadow().textContent).toContain('3 events')
        expect(shadow().querySelector('.pps-chip.e')?.getAttribute('title')).toContain('x')

        handle.unmount()
        expect(document.getElementById(hostId)).toBeNull()
    })

    it('shows the store context and escapes payload markup', async () => {
        const registry = createTracerRegistry({ journal: true })
        registry.tracerHandler.createTracer('Store')
            .debug('PluginSubscription:context', 'pluginsubscription:context', { note: '<img src=x onerror=alert(1)>' }, 'cart')
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        Array.from(shadow().querySelectorAll('button')).find(b => b.textContent === 'Context')!.click()
        await flush()

        expect(shadow().textContent).toContain('<img src=x onerror=alert(1)>')
        expect(shadow().querySelector('img')).toBeNull()
        handle.unmount()
    })

    it('toggles with the shortcut and the floating button', async () => {
        const registry = createTracerRegistry({ journal: true })
        const handle = mountTraceDevtools(registry, { shortcut: 'Alt+Shift+P' })
        await flush()
        expect(shadow().querySelector('.pps-fab')?.textContent).toContain('Devtools')

        document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'P', shiftKey: true }))
        await flush()
        expect(shadow().querySelector('aside')).not.toBeNull()

        handle.close()
        await flush()
        expect(shadow().querySelector('aside')).toBeNull()
        handle.unmount()
    })

    it('shows events appended after mounting without remounting', async () => {
        const registry = createTracerRegistry({ journal: true })
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()
        expect(shadow().textContent).toContain('No store traced yet.')

        registry.tracerHandler.createTracer('Store').debug('Late', 'ns', undefined, 'cart')
        await flush()

        expect(shadow().textContent).not.toContain('No store traced yet.')
        expect(shadow().textContent).toContain('cart')
        expect(shadow().textContent).toContain('Late')
        handle.unmount()
    })

    it('updates the floating button error badge after mounting', async () => {
        const registry = createTracerRegistry({ journal: true })
        const handle = mountTraceDevtools(registry)
        await flush()
        expect(shadow().querySelector('.pps-fab.has-errors')).toBeNull()

        vi.spyOn(console, 'error').mockImplementation(() => { })
        registry.tracerHandler.createTracer('Store').error('Failed', 'ns', new Error('x'), undefined, 'cart')
        await flush()

        expect(shadow().querySelector('.pps-fab.has-errors')?.textContent).toContain('1')
        handle.unmount()
    })
})
