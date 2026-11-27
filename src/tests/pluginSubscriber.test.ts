import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PiniaPluginContext } from 'pinia'
import PluginSubscriber from '../core/PluginSubscriber'
import PluginSubscription from '../core/PluginSubscription'
import Store from '../core/Store'
import { createEventsRegistry } from '../factories/events-registry'
import { createTestTracerRegistry } from './support/testTracer'

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
            protected _name: string = 'my-plugin'
            constructor() { super(createInstance) }
        })()

        expect(subscriber.name).toBe('my-plugin')
        expect((subscriber as any).console).toBeUndefined()
    })

    it('looks up wrappers by store identity and preserves other entries when creation fails', () => {
        const createInstance = vi.fn((store: PiniaPluginContext['store']) => {
            if (store.$id === 'skipped') return undefined
            return new Store(store, {})
        })
        const subscriber = new (class extends PluginSubscriber<Store> {
            protected _name: string = 'my-plugin'
            constructor() { super(createInstance) }
        })()
        const first = createContext({ $id: 'same', $state: {} })
        const second = createContext({ $id: 'same', $state: {} })
        const skipped = createContext({ $id: 'skipped', $state: {} })

        expect(subscriber.getStoreInstance(first.store)).toBeUndefined()
        expect(subscriber.invoke(first)).toBe(true)
        expect(subscriber.invoke(second)).toBe(true)
        expect(subscriber.invoke(skipped)).toBe(false)
        expect(subscriber.getStoreInstance(first.store)?.store).toBe(first.store)
        expect(subscriber.getStoreInstance(second.store)?.store).toBe(second.store)
        expect(subscriber.getStoreInstance(skipped.store)).toBeUndefined()
    })

    it('keeps concurrent hydration and afterHydration scoped to each store', async () => {
        function gate() {
            let release!: () => void
            let complete!: () => void
            const pending = new Promise<void>(resolve => { release = resolve })
            const completed = new Promise<void>(resolve => { complete = resolve })
            return { pending, release, completed, complete }
        }

        const first = createContext({ $id: 'same', $state: {}, $dispose: vi.fn() })
        const second = createContext({ $id: 'same', $state: {}, $dispose: vi.fn() })
        const firstGate = gate()
        const secondGate = gate()
        const gates = new Map([
            [first.store, firstGate],
            [second.store, secondGate]
        ])
        const hydrated: unknown[] = []
        const afterHydrated: unknown[] = []

        class Subscriber extends PluginSubscriber<Store> {
            protected _name = 'concurrent'
            constructor() { super((store, options) => new Store(store, options)) }

            override async hydrate(context: PiniaPluginContext): Promise<void> {
                await gates.get(context.store)!.pending
                hydrated.push(this.getStoreInstance(context.store)?.store)
            }

            override afterHydration(context: PiniaPluginContext): void {
                afterHydrated.push(this.getStoreInstance(context.store)?.store)
                gates.get(context.store)!.complete()
            }
        }

        const subscriber = new Subscriber()
        const plugin = new PluginSubscription([subscriber])
        plugin.plugin(first)
        plugin.plugin(second)

        secondGate.release()
        await secondGate.completed
        firstGate.release()
        await firstGate.completed

        expect(hydrated).toEqual([second.store, first.store])
        expect(afterHydrated).toEqual([second.store, first.store])
        first.store.$dispose()
        second.store.$dispose()
    })

    it('should set and get pluginOptions', () => {
        const createInstance = vi.fn()

        const subscriber = new (class extends PluginSubscriber<any> {
            protected _name: string = 'my-plugin'
            constructor() { super(createInstance) }
        })()

        subscriber.pluginOptions = { storeOptions: { optionA: 'valueA' } }
        expect(subscriber.pluginOptions).toEqual({ storeOptions: { optionA: 'valueA' } })
    })

    it('creates and exposes the subscriber tracer and passes it to the store factory', () => {
        const registry = createTestTracerRegistry()
        const tracer = registry.tracerHandler.createTracer('my-plugin')
        const createTracer = vi.fn(() => tracer)
        const instance = {
            getSubscriptions: vi.fn().mockReturnValue({}),
            storeSubscribe: undefined,
            onAction: undefined,
        }
        const createInstance = vi.fn().mockReturnValue(instance)
        const subscriber = new (class extends PluginSubscriber<any> {
            protected _name: string = 'my-plugin'
            constructor() { super(createInstance) }
        })()

        subscriber.invoke(createContext({ $state: {} }), {
            createTracer,
            eventsRegistry: createEventsRegistry(),
        })

        expect(createTracer).toHaveBeenCalledWith('my-plugin')
        expect(subscriber.tracer).toBe(tracer)
        expect(createInstance.mock.calls[0]?.[1].createTracer?.()).toBe(tracer)
    })

    it('should set and get subscriptions', () => {
        const createInstance = vi.fn()

        const subscriber = new (class extends PluginSubscriber<any> {
            protected _name: string = 'my-plugin'
            constructor() { super(createInstance) }
        })()

        const pluginAInvoke = vi.fn(() => true)
        subscriber.subscriptions = {
            pluginA: {
                subscription: { name: 'pluginA', invoke: pluginAInvoke }
            }
        }
        const subscriptions = subscriber.subscriptions
        expect(typeof subscriptions?.pluginA?.subscription.invoke).toEqual('function')
    })

    it('should do nothing when createInstance returns undefined', () => {
        const createInstance = vi.fn().mockReturnValue(undefined)

        const subscriber = new (class extends PluginSubscriber<any> {
            protected _name: string = 'noop'
            constructor() { super(createInstance) }
        })()

        const ctx = createContext({ $state: {} })

        subscriber.invoke(ctx)

        expect(createInstance).toHaveBeenCalledWith(ctx.store, ctx.options)
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
            protected _name: string = 'ext'
            constructor() {
                super(createInstance)
                this.pluginCreated = pluginCreated
            }
        })()

        const store = { $state: { count: 0 } }
        const ctx = createContext(store)

        subscriber.invoke(ctx)

        expect(createInstance).toHaveBeenCalledWith(ctx.store, ctx.options)
        expect(subscriber.subscriptions).toBe(subscriptions)
        expect(subscriber.storeMutationSubscription).toBe(instance.storeSubscribe)
        expect(subscriber.storeOnActionSubscription).toBe(instance.onAction)
        expect(pluginCreated).toHaveBeenCalledWith(ctx.store)
    })

    it('should work when pluginCreated is not provided', () => {
        const instance = {
            getSubscriptions: vi.fn().mockReturnValue({}),
            storeSubscribe: undefined,
            onAction: undefined,
        }

        const createInstance = vi.fn().mockReturnValue(instance)

        const subscriber = new (class extends PluginSubscriber<any> {
            protected _name: string = 'no-pluginCreated'
            constructor() { super(createInstance) }
        })()

        const store = { $state: { count: 0 } }
        const ctx = createContext(store)

        expect(() => subscriber.invoke(ctx)).not.toThrow()
        expect(subscriber.subscriptions).toEqual({})
    })
})
