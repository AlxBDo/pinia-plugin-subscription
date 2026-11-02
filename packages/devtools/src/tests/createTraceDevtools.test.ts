// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlugin } from 'pinia-plugin-subscription'
import { createTraceDevtools } from '../factories/trace-devtools'

const hostId = 'pinia-plugin-subscription-devtools'

function addSnapshot(events: unknown[]) {
    const snapshot = document.createElement('script')
    snapshot.id = 'pinia-traces'
    snapshot.type = 'application/json'
    snapshot.textContent = JSON.stringify({ version: 1, events })
    document.body.appendChild(snapshot)
}

describe('createTraceDevtools', () => {
    afterEach(() => {
        document.body.innerHTML = ''
        vi.unstubAllEnvs()
    })

    it('creates a redacted journal and mounts the panel with the supplied options', () => {
        addSnapshot([{
            label: 'Server trace',
            level: 'debug',
            namespace: 'demo:server',
            payload: { ready: true },
            seq: 1,
            source: 'SSR',
            timestamp: 1
        }])

        const { handle, registry } = createTraceDevtools({ open: true, width: 600 })

        expect(handle).toBeDefined()
        expect(document.getElementById(hostId)).not.toBeNull()
        expect(registry.journal!.getEvents('__global__')).toHaveLength(1)

        registry.tracerHandler.createTracer('Demo')
            .debug('Example trace', 'demo:trace', { password: 'secret', visible: true }, 'demo')
        expect(registry.journal!.getEvents('demo')[0].payload).toEqual({
            password: '[REDACTED]',
            visible: true
        })
    })

    it('does not import the snapshot when serverSnapshotId is false', () => {
        addSnapshot([{ label: 'Server trace', level: 'debug', namespace: 'demo:server', seq: 1, source: 'SSR', timestamp: 1 }])

        const { registry } = createTraceDevtools({ serverSnapshotId: false })

        expect(registry.journal!.getScopes()).toEqual([])
    })

    it('reports an invalid snapshot without breaking the page', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => { })
        const snapshot = document.createElement('script')
        snapshot.id = 'pinia-traces'
        snapshot.type = 'application/json'
        snapshot.textContent = '{'
        document.body.appendChild(snapshot)

        expect(() => createTraceDevtools()).not.toThrow()
        expect(error).toHaveBeenCalled()
        error.mockRestore()
    })

    it('does not mount the panel in production', () => {
        vi.stubEnv('NODE_ENV', 'production')

        const { handle, registry } = createTraceDevtools()

        expect(handle).toBeUndefined()
        expect(registry.journal).toBeUndefined()
        expect(document.getElementById(hostId)).toBeNull()
    })

    it('provides a tracer handler the plugin accepts', () => {
        const { registry } = createTraceDevtools()

        expect(() => createPlugin([], { tracerHandler: registry.tracerHandler })).not.toThrow()
    })
})
