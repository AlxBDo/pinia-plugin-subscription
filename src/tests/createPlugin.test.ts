import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPlugin } from '../plugins/createPlugin'
import pluginSubscription from '../plugins/pluginCreation'
import type { PluginSubscriber } from '../types/plugin'

vi.mock('../plugins/pluginCreation', () => ({
    default: {
        debug: false,
        subscribers: [],
        plugin: vi.fn(),
    },
}))

describe('createPlugin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should set subscribers and debug on pluginSubscription', () => {
        const subscribers: PluginSubscriber[] = [{ invoke: vi.fn() } as unknown as PluginSubscriber]
        const result = createPlugin(subscribers, true)

        expect(pluginSubscription.subscribers).toBe(subscribers)
        expect(pluginSubscription.debug).toBe(true)
    })

    it('should return a bound function', () => {
        const subscribers: PluginSubscriber[] = []
        const result = createPlugin(subscribers)

        expect(typeof result).toBe('function')
    })

    it('should default debug to false when not provided', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers)

        expect(pluginSubscription.debug).toBe(false)
    })

    it('should set debug to false when debug is not a boolean', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers, 'invalid' as any)

        expect(pluginSubscription.debug).toBe(false)
    })

    it('should handle empty subscribers array', () => {
        const subscribers: PluginSubscriber[] = []
        createPlugin(subscribers, true)

        expect(pluginSubscription.subscribers).toEqual([])
        expect(pluginSubscription.debug).toBe(true)
    })
})