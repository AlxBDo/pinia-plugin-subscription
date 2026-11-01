// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlugin } from '../plugins/createPlugin'

const mocks = vi.hoisted(() => ({
    constructorArgs: [] as unknown[][],
    mountTraceDevtools: vi.fn()
}))

vi.mock('../core/PluginSubscription', () => ({
    default: class {
        plugin = vi.fn()

        constructor(...args: unknown[]) {
            mocks.constructorArgs.push(args)
        }
    }
}))

vi.mock('../devtools', () => ({
    mountTraceDevtools: mocks.mountTraceDevtools
}))

describe('createPlugin devtools option', () => {
    beforeEach(() => {
        mocks.constructorArgs.length = 0
        mocks.mountTraceDevtools.mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('creates a redacted journal and mounts the panel with the supplied options', async () => {
        const panelOptions = { open: true, width: 600 }
        const snapshot = document.createElement('script')
        snapshot.id = 'pinia-traces'
        snapshot.type = 'application/json'
        snapshot.textContent = JSON.stringify({
            version: 1,
            events: [{
                label: 'Server trace',
                level: 'debug',
                namespace: 'demo:server',
                payload: { ready: true },
                seq: 1,
                source: 'SSR',
                timestamp: 1
            }]
        })
        document.body.appendChild(snapshot)

        createPlugin([], { devtools: panelOptions })
        await vi.dynamicImportSettled()

        expect(mocks.constructorArgs[0][1]).toEqual(expect.objectContaining({
            tracerHandler: expect.objectContaining({
                createTracer: expect.any(Function)
            })
        }))
        expect(mocks.mountTraceDevtools).toHaveBeenCalledOnce()

        const [registry, options] = mocks.mountTraceDevtools.mock.calls[0]
        expect(registry.journal).toBeDefined()
        expect(registry.journal.getEvents('__global__')).toHaveLength(1)
        expect(registry.tracerHandler).toBe(mocks.constructorArgs[0][1].tracerHandler)
        expect(options).toEqual(panelOptions)

        registry.tracerHandler.createTracer('Demo')
            .debug('Example trace', 'demo:trace', { password: 'secret', visible: true }, 'demo')
        expect(registry.journal.getEvents('demo')[0].payload).toEqual({
            password: '[REDACTED]',
            visible: true
        })
    })

    it('reuses a registry journal when a tracer handler is supplied', async () => {
        const { createTracerRegistry } = await import('../factories/trace-registry')
        const registry = createTracerRegistry({ journal: true })

        createPlugin([], { devtools: true, tracerHandler: registry.tracerHandler })
        await vi.dynamicImportSettled()

        expect(mocks.constructorArgs[0][1].tracerHandler).toBe(registry.tracerHandler)
        expect(mocks.mountTraceDevtools).toHaveBeenCalledWith(
            { journal: registry.journal },
            undefined
        )
    })

    it('rejects a custom tracer handler without a journal', () => {
        expect(() => createPlugin([], {
            devtools: true,
            tracerHandler: {
                closeGroup: vi.fn(),
                createTracer: vi.fn(),
                startGroup: vi.fn()
            }
        })).toThrow('The devtools option requires a registry tracerHandler with a journal.')
    })

    it('does not load the panel in production', async () => {
        vi.stubEnv('NODE_ENV', 'production')

        createPlugin([], { devtools: true })
        await vi.dynamicImportSettled()

        expect(mocks.mountTraceDevtools).not.toHaveBeenCalled()
    })

    it('can disable automatic SSR snapshot import', async () => {
        const snapshot = document.createElement('script')
        snapshot.id = 'pinia-traces'
        snapshot.type = 'application/json'
        snapshot.textContent = JSON.stringify({ version: 1, events: [] })
        document.body.appendChild(snapshot)

        createPlugin([], { devtools: { serverSnapshotId: false } })
        await vi.dynamicImportSettled()

        const [registry] = mocks.mountTraceDevtools.mock.calls[0]
        expect(registry.journal.getScopes()).toEqual([])
    })
})
