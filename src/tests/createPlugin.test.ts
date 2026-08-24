import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPlugin } from '../plugins/createPlugin'
import { createHydrationPlugin } from '../plugins/createHydrationPlugin'
import pluginSubscription from '../plugins/pluginSubscription'
import type { PluginSubscriber } from '../types/plugin'

vi.mock('../plugins/pluginSubscription', () => ({
    default: vi.fn().mockImplementation(function (
        this: {
            debug?: unknown
            plugin?: ReturnType<typeof vi.fn>
            subscribers?: unknown
        },
        subscribers: any,
        debug: boolean
    ) {
        this.subscribers = subscribers
        this.debug = debug
        this.plugin = vi.fn()
    })
}))

describe('createPlugin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should set subscribers and debug on pluginSubscription', () => {
        const subscribers: PluginSubscriber[] = [{ invoke: vi.fn() } as unknown as PluginSubscriber]
        createPlugin(subscribers, undefined)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, undefined)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.subscribers).toBe(subscribers)
        expect(instance.debug).toBe(undefined)
    })

    it('should return a bound function', () => {
        const subscribers: PluginSubscriber[] = []
        const plugin = createPlugin(subscribers)

        expect(typeof plugin).toBe('function')
    })

    it('should default debug to false when not provided', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, undefined)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.debug).toBe(undefined)
    })

    it('should accept a debug list as second argument', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers, ['PluginSubscription'])

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, ['PluginSubscription'])
    })

    it('should handle empty subscribers array', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers)

        expect((pluginSubscription as any)).toHaveBeenCalledWith([], undefined)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.subscribers).toEqual([])
    })

    it('should forward hydration options to createHydrationPlugin', () => {
        const subscribers: PluginSubscriber[] = [{ invoke: vi.fn() } as unknown as PluginSubscriber]
        const options = { runtimeEnvironment: 'client', hydrationScheduler: vi.fn() }

        createHydrationPlugin(subscribers, options)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, undefined, {
            execution: undefined,
            hydrationScheduler: options.hydrationScheduler,
            runtimeEnvironment: 'client',
            subscriberExecution: undefined,
        })
    })
})