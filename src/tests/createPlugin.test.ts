import { beforeEach, describe, expect, it, vi } from 'vitest'
import pluginSubscription from '../core/PluginSubscription'
import { createHydrationPlugin } from '../plugins/createHydrationPlugin'
import { createPlugin } from '../plugins/createPlugin'

import type { PluginSubscriber } from '../types/plugin'

vi.mock('../core/PluginSubscription', () => ({
    default: vi.fn().mockImplementation(function (
        this: {
            plugin?: ReturnType<typeof vi.fn>
            subscribers?: unknown
        },
        subscribers: PluginSubscriber[]
    ) {
        this.subscribers = subscribers
        this.plugin = vi.fn()
    })
}))

describe('createPlugin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes subscribers to PluginSubscription', () => {
        const subscribers: PluginSubscriber[] = [{ invoke: vi.fn() } as unknown as PluginSubscriber]

        createPlugin(subscribers)

        expect(pluginSubscription).toHaveBeenCalledWith(subscribers)
    })

    it('returns a bound function', () => {
        expect(typeof createPlugin([])).toBe('function')
    })

    it('handles an empty subscribers array', () => {
        createPlugin([])

        expect(pluginSubscription).toHaveBeenCalledWith([])
    })

    it('forwards hydration options', () => {
        const subscribers: PluginSubscriber[] = [{ invoke: vi.fn() } as unknown as PluginSubscriber]
        const options = { runtimeEnvironment: 'client' as const, hydrationScheduler: vi.fn() }

        createHydrationPlugin(subscribers, options)

        expect(pluginSubscription).toHaveBeenCalledWith(subscribers, {
            execution: undefined,
            hydrationScheduler: options.hydrationScheduler,
            runtimeEnvironment: 'client',
            subscriberExecution: undefined,
        })
    })
})
