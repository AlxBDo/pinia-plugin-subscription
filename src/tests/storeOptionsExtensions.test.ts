import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PiniaPluginContext, Store } from 'pinia'
import type { PluginSubscriber } from '../types/plugin'
import PluginSubscription from '../core/PluginSubscription'

describe('StoreOptionsExtensions', () => {
    let pluginSub: PluginSubscription

    beforeEach(() => {
        pluginSub = new PluginSubscription([])
    })

    it('delivers store-declared extension keys to subscribers, merged with subscriptionOptions', () => {
        const subscriptionInvoke = vi.fn()

        const subscriber: PluginSubscriber = {
            name: 'ext-subscriber',
            console: console,
            invoke: vi.fn().mockReturnValue(true),
            subscriptions: {
                'ext-subscriber': {
                    subscription: { console: console, invoke: subscriptionInvoke, name: 'ext-plugin' },
                    subscriptionOptions: { testExtension: 'from-subscription', subOnly: true },
                },
            },
        }

        pluginSub.subscribers = [subscriber]

        const store = {
            $id: 'ext-store',
            $state: {},
            $patch: vi.fn(),
            $reset: vi.fn(),
        } as unknown as Store

        // Store-declared options carry the subscriber-specific extension keys
        // (typed via StoreOptionsExtensions in the subscriber's own package).
        const options = {
            storeOptions: {
                testExtension: 'from-store',
                storeOnly: true,
            },
        }

        pluginSub.plugin({ store, options } as unknown as PiniaPluginContext)

        expect(subscriptionInvoke).toHaveBeenCalledTimes(1)

        const [context] = subscriptionInvoke.mock.calls[0]!

        expect(context.options.storeOptions).toEqual({
            // subscriptionOptions win on conflicting keys
            testExtension: 'from-subscription',
            subOnly: true,
            // store-declared extension keys are preserved
            storeOnly: true,
        })
    })

    it('delivers an empty storeOptions object when the store declares no options', () => {
        const subscriptionInvoke = vi.fn()

        const subscriber: PluginSubscriber = {
            name: 'ext-subscriber-empty',
            console: console,
            invoke: vi.fn().mockReturnValue(true),
            subscriptions: {
                'ext-subscriber-empty': {
                    subscription: { console: console, invoke: subscriptionInvoke, name: 'ext-plugin' },
                },
            },
        }

        pluginSub.subscribers = [subscriber]

        const store = {
            $id: 'ext-store-empty',
            $state: {},
            $patch: vi.fn(),
            $reset: vi.fn(),
        } as unknown as Store

        pluginSub.plugin({ store, options: {} } as unknown as PiniaPluginContext)

        expect(subscriptionInvoke).toHaveBeenCalledTimes(1)

        const [context] = subscriptionInvoke.mock.calls[0]!

        expect(context.options.storeOptions).toEqual({})
    })
})
