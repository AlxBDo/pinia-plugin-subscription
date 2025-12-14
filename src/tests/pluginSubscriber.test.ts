import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PiniaPluginContext } from 'pinia'
import PluginSubscriber from '../plugins/pluginSubscriber'

function createContext(store: any): PiniaPluginContext {
    return {
        store,
        options: {},
    } as unknown as PiniaPluginContext
}

describe('PluginSubscriber (abstract)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should expose the name provided in constructor', () => {
        const createInstance = vi.fn()

        const subscriber = new (class extends PluginSubscriber<any> {
            constructor() { super('my-plugin', createInstance) }
        })()

        expect(subscriber.name).toBe('my-plugin')
    })

    it('should do nothing when createInstance returns undefined', () => {
        const createInstance = vi.fn().mockReturnValue(undefined)

        const subscriber = new (class extends PluginSubscriber<any> {
            constructor() { super('noop', createInstance) }
        })()

        const ctx = createContext({ $state: {} })

        subscriber.invoke(ctx, true)

        expect(createInstance).toHaveBeenCalledWith(ctx.store, ctx.options, true)
        expect(subscriber.subscriptions).toBeUndefined()
        expect(subscriber.storeMutationSubscription).toBeUndefined()
        expect(subscriber.storeOnActionSubscription).toBeUndefined()
    })

    it('should set subscriptions and subscription helpers when instance is returned', () => {
        const subscriptions = { pluginA: vi.fn() }

        const instance = {
            getSubscriptions: vi.fn().mockReturnValue(subscriptions),
            storeSubscribe: 'storeSubscribeValue',
            onAction: 'onActionValue',
        }

        const createInstance = vi.fn().mockReturnValue(instance)
        const pluginCreated = vi.fn()

        const subscriber = new (class extends PluginSubscriber<any> {
            constructor() {
                super('ext', createInstance)
                this.pluginCreated = pluginCreated
                this._resetStoreCallback = (s?: any) => { /* noop */ }
            }
        })()

        const store = { $state: { count: 0 } }
        const ctx = createContext(store)

        subscriber.invoke(ctx)

        expect(createInstance).toHaveBeenCalledWith(ctx.store, ctx.options, undefined)
        expect(subscriber.subscriptions).toBe(subscriptions)
        expect(subscriber.storeMutationSubscription).toBe(instance.storeSubscribe)
        expect(subscriber.storeOnActionSubscription).toBe(instance.onAction)
        expect(pluginCreated).toHaveBeenCalledWith(ctx.store)
        expect(typeof subscriber.resetStoreCallback).toBe('function')
    })

    it('should set subscriptions via setter', () => {
        const createInstance = vi.fn()

        const subscriber = new (class extends PluginSubscriber<any> {
            constructor() { super('setter-test', createInstance) }
        })()

        const subs = { myPlugin: (s?: any) => [s] }
        subscriber.subscriptions = subs

        expect(subscriber.subscriptions).toBe(subs)
    })

    it('should work when pluginCreated is not provided', () => {
        const instance = {
            getSubscriptions: vi.fn().mockReturnValue({}),
            storeSubscribe: undefined,
            onAction: undefined,
        }

        const createInstance = vi.fn().mockReturnValue(instance)

        const subscriber = new (class extends PluginSubscriber<any> {
            constructor() { super('no-pluginCreated', createInstance) }
        })()

        const store = { $state: { count: 0 } }
        const ctx = createContext(store)

        expect(() => subscriber.invoke(ctx)).not.toThrow()
        expect(subscriber.subscriptions).toEqual({})
    })
})
