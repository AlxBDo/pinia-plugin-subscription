// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createTracerRegistry } from '../factories/trace-registry'
import { mountTraceDevtools } from '../devtools'

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

    it('renders an isolated panel, grouped by action, with live updates', async () => {
        const registry = createTracerRegistry({ journal: true })
        const tracer = registry.tracerHandler.createTracer('Store')
        tracer.debug('PluginSubscription:context', 'pluginsubscription:context', { subscribers: ['sub'] }, 'cart')
        tracer.debug('Start', 'ns', { actionId: 'cart#1' }, 'cart')
        const handle = mountTraceDevtools(registry, { open: true })
        await flush()

        expect(shadow().querySelector('aside')).not.toBeNull()
        expect(shadow().textContent).toContain('cart#1')
        expect(document.body.querySelector('aside')).toBeNull()

        tracer.error('Failed', 'ns', new Error('x'), { actionId: 'cart#1' }, 'cart')
        vi.spyOn(console, 'error').mockImplementation(() => { })
        await flush()
        expect(shadow().textContent).toContain('2 events')

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
        expect(shadow().querySelector('.pps-fab')).not.toBeNull()

        document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'P', shiftKey: true }))
        await flush()
        expect(shadow().querySelector('aside')).not.toBeNull()

        handle.close()
        await flush()
        expect(shadow().querySelector('aside')).toBeNull()
        handle.unmount()
    })
})
