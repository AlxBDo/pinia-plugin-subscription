import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPlugin } from '../plugins/createPlugin'
import pluginSubscription from '../plugins/pluginSubscription'
import type { PluginSubscriber } from '../types/plugin'

vi.mock('../plugins/pluginSubscription', () => ({
    default: vi.fn().mockImplementation(function (subscribers: any, debug: boolean) {
        // emulate instance properties
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
        const result = createPlugin(subscribers, true)

        // The mock is a constructor function so ensure it was called with the right args
        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, true)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.subscribers).toBe(subscribers)
        expect(instance.debug).toBe(true)
    })

    it('should return a bound function', () => {
        const subscribers: PluginSubscriber[] = []
        const result = createPlugin(subscribers)

        expect(typeof result).toBe('function')
    })

    it('should default debug to false when not provided', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, false)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.debug).toBe(false)
    })

    it('should set debug to false when debug is not a boolean', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers, 'invalid' as any)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, false)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.debug).toBe(false)
    })

    it('should handle empty subscribers array', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers, true)

        expect((pluginSubscription as any)).toHaveBeenCalledWith(subscribers, true)
        const instance = (pluginSubscription as any).mock.instances[0]
        expect(instance.subscribers).toEqual([])
        expect(instance.debug).toBe(true)
    })
})