import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PiniaPluginContext, Store } from 'pinia'
import type { PluginSubscriber, PluginSubscriptionOptions } from '../types/plugin'
import PluginSubscription from '../core/PluginSubscription'
import { createConsoleTraceListener } from '../system/createConsoleTraceListener'
import { createTracerRegistry } from '../factories/trace-registry'
import type { TraceEvent } from '../types/trace'

function createContext(store: Store): PiniaPluginContext {
    return {
        store,
        options: {},
    } as unknown as PiniaPluginContext
}

const { addTraceListener, clearTraceListeners, createTracer, hasTraceListeners } = createTracerRegistry()

function getPluginSubscription(
    subscribers: PluginSubscriber[],
    options?: PluginSubscriptionOptions
) {
    return new PluginSubscription(subscribers, {
        ...(options ?? {}),
        createTracer,
    })
}



describe('PluginSubscription', () => {
    let pluginSub: PluginSubscription

    beforeEach(() => {
        clearTraceListeners()
        addTraceListener({
            ...createConsoleTraceListener(),
            filter: event => event.level === 'error'
        })
        // Create a fresh instance before each test
        pluginSub = getPluginSubscription([])
    })

    it('does not expose the removed debug configuration', () => {
        expect((pluginSub as any).debug).toBeUndefined()
        expect((pluginSub as any).console).toBeUndefined()
    })

    describe('structured tracing', () => {
        function createTracedStore(): Store {
            return {
                $id: 'cart',
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store
        }

        it('emits plugin:invoke scoped to the store id', () => {
            const events: TraceEvent[] = []
            addTraceListener({ handler: (event) => { events.push(event) } })
            pluginSub.subscribers = [{ name: 's', invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }]

            pluginSub.plugin(createContext(createTracedStore()))

            const invoke = events.find(event => event.namespace === 'plugin:invoke')
            expect(invoke).toMatchObject({ scope: 'cart', source: 'PluginSubscription' })
        })

        it('supports filtering a single store at runtime', () => {
            const events: TraceEvent[] = []
            addTraceListener({ filter: (event) => event.scope === 'other', handler: (event) => { events.push(event) } })
            pluginSub.subscribers = [{ name: 's', invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }]

            pluginSub.plugin(createContext(createTracedStore()))

            expect(events).toHaveLength(0)
        })

        it('emits store:reset when the rewritten $reset runs', () => {
            const events: TraceEvent[] = []
            addTraceListener({ handler: (event) => { events.push(event) } })
            const store = createTracedStore()
            pluginSub.subscribers = [{ name: 's', invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }]

            pluginSub.plugin(createContext(store))
            store.$reset()

            expect(events.some(event => event.namespace === 'plugin:reset' && event.scope === 'cart')).toBe(true)
        })

        it('reports subscriber failures as error events without throwing', () => {
            const events: TraceEvent[] = []
            addTraceListener({ handler: (event) => { events.push(event) } })
            pluginSub.subscribers = [{
                name: 's',
                invoke: vi.fn(() => { throw new Error('subscriber down') }),
                subscriptions: undefined
            }]

            expect(() => pluginSub.plugin(createContext(createTracedStore()))).not.toThrow()

            const failure = events.find(event => event.level === 'error')
            expect(failure).toBeDefined()
            expect(failure?.error).toBeInstanceOf(Error)
        })
    })

    describe('subscribers setter', () => {
        it('should set subscribers array', () => {
            const mockSubscriber: PluginSubscriber = {
                name: 'mock',
                invoke: vi.fn(),
                subscriptions: undefined,
            }
            const subscribers = [mockSubscriber]

            pluginSub.subscribers = subscribers

            expect((pluginSub as any)._subscribers).toEqual(subscribers)
        })

        it('should replace existing subscribers with new ones', () => {
            const subscriber1: PluginSubscriber = { name: 'a', invoke: vi.fn(), subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 'b', invoke: vi.fn(), subscriptions: undefined }

            pluginSub.subscribers = [subscriber1]
            pluginSub.subscribers = [subscriber2]

            expect((pluginSub as any)._subscribers).toEqual([subscriber2])
            expect((pluginSub as any)._subscribers.length).toBe(1)
        })
    })

    describe('reset callbacks via plugin', () => {
        it('should register reset callback provided by subscriber during plugin init', () => {
            const callback = vi.fn()
            const subscriber: PluginSubscriber = { name: 's', invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback, subscriptions: undefined }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect((pluginSub as any)._resetStoreCallback.get(mockStore)).toContain(callback)
        })

        it('should execute multiple reset callbacks when $reset is called', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const subscriber1: PluginSubscriber = { name: 's1', invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback1, subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 's2', invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback2, subscriptions: undefined }

            pluginSub.subscribers = [subscriber1, subscriber2]

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            mockStore.$reset!()

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
        })

        it('should deduplicate callbacks per store and release them on disposal', () => {
            const callback = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'reset',
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: callback
            }
            pluginSub.subscribers = [subscriber, { ...subscriber, name: 'reset-again' }]
            const makeStore = () => ({
                $id: 'reset-store',
                $state: { count: 0 },
                $patch: vi.fn(),
                $dispose: vi.fn()
            } as unknown as Store)
            const first = makeStore()
            const other = { ...makeStore(), $id: 'other' } as Store

            pluginSub.plugin(createContext(first))
            pluginSub.plugin(createContext(other))
            first.$reset!()
            expect(callback).toHaveBeenCalledTimes(1)
            expect(callback).toHaveBeenCalledWith(first)
            expect((pluginSub as any)._resetStoreCallback.get(first).size).toBe(1)

            first.$dispose!()
            expect((pluginSub as any)._resetStoreCallback.has(first)).toBe(false)
            const recreated = makeStore()
            pluginSub.plugin(createContext(recreated))
            recreated.$reset!()
            other.$reset!()
            expect(callback.mock.calls.map(([store]) => store)).toEqual([first, recreated, other])
            other.$dispose!()
            recreated.$dispose!()
            expect((pluginSub as any)._resetStoreCallback.size).toBe(0)
        })
    })



    describe('edge cases', () => {
        it('should clone Map and Set values when $reset is executed', () => {
            const subscriber: PluginSubscriber = {
                name: 'map-set-reset',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const initialMap = new Map<string, { nested: number }>([['first', { nested: 1 }]])
            const initialSet = new Set([{ nested: 2 }, 'ready'])
            const mockStore = {
                $id: 'reset-maps',
                $state: {
                    records: initialMap,
                    tags: initialSet,
                },
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin(createContext(mockStore))
            mockStore.$reset!()

            expect(mockStore.$patch).toHaveBeenCalledWith(expect.objectContaining({
                records: expect.any(Map),
                tags: expect.any(Set),
            }))

            const resetState = (mockStore.$patch as any).mock.calls[0][0]
            expect(resetState.records).not.toBe(initialMap)
            expect(resetState.tags).not.toBe(initialSet)
            expect(resetState.records.get('first')).toEqual({ nested: 1 })
            expect(resetState.tags.has('ready')).toBe(true)
        })

        it('should allow a new store instance with the same $id after dispose', () => {
            const subscriber: PluginSubscriber = {
                name: 'recreated-store',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const firstStore = {
                $id: 'same-id',
                $state: { count: 1 },
                $patch: vi.fn(),
                $reset: vi.fn(),
                $dispose: vi.fn(),
            } as unknown as Store

            pluginSub.plugin(createContext(firstStore))
            firstStore.$dispose!()

            const secondStore = {
                $id: 'same-id',
                $state: { count: 2 },
                $patch: vi.fn(),
                $reset: vi.fn(),
                $dispose: vi.fn(),
            } as unknown as Store

            pluginSub.plugin(createContext(secondStore))

            expect(subscriber.invoke).toHaveBeenCalledTimes(2)
        })

        it('should ignore hydrate and afterHydration errors without breaking store registration', async () => {
            const subscriber: PluginSubscriber = {
                name: 'hydration-errors',
                invoke: vi.fn().mockReturnValue(true),
                hydrate: vi.fn(() => {
                    throw new Error('hydrate failure')
                }),
                afterHydration: vi.fn(() => {
                    throw new Error('afterHydration failure')
                }),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockContext = createContext({
                $id: 'hydrate-errors',
                $state: { count: 0 },
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store)

            expect(() => pluginSub.plugin(mockContext)).not.toThrow()
            await Promise.resolve()
            expect(subscriber.invoke).toHaveBeenCalledWith(mockContext, createTracer)
        })
    })

    describe('executeResetStoreCallbacks', () => {
        it('should execute all reset store callbacks', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const callback3 = vi.fn()

            const mockStore = { $state: {} }
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback1)
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback2)
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback3)

                ; (pluginSub as any).executeResetStoreCallbacks(mockStore)

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
            expect(callback3).toHaveBeenCalledWith(mockStore)
        })

        it('should execute callbacks in the correct order', () => {
            const callOrder: number[] = []
            const callback1 = vi.fn(() => callOrder.push(1))
            const callback2 = vi.fn(() => callOrder.push(2))
            const callback3 = vi.fn(() => callOrder.push(3))

            const mockStore = { $state: {} } as Store
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback1)
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback2)
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback3)

                ; (pluginSub as any).executeResetStoreCallbacks(mockStore)

            expect(callOrder).toEqual([1, 2, 3])
        })

        it('should handle empty callbacks array', () => {
            const mockStore = { $state: {} } as Store

            expect(() => {
                ; (pluginSub as any).executeResetStoreCallbacks(mockStore)
            }).not.toThrow()
        })
    })

    describe('plugin method', () => {
        it('should return early if there are no subscribers', () => {
            const mockContext = createContext({ $state: {} } as Store)

            expect(() => {
                pluginSub.plugin(mockContext)
            }).not.toThrow()
        })

        it('should invoke all subscribers with the correct context', () => {
            const subscriber1: PluginSubscriber = { name: 'a', invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 'b', invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }

            pluginSub = getPluginSubscription([subscriber1, subscriber2])

            const mockContext = createContext({
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            pluginSub.plugin(mockContext)

            expect(subscriber1.invoke).toHaveBeenCalledWith(mockContext, createTracer)
            expect(subscriber2.invoke).toHaveBeenCalledWith(mockContext, createTracer)
        })

        it('should skip client-only subscribers while running on the server', () => {
            const subscriber: PluginSubscriber = {
                name: 'client-only',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub = getPluginSubscription([subscriber], {
                runtimeEnvironment: 'server',
                subscriberExecution: {
                    'client-only': {
                        environment: 'client'
                    }
                }
            })

            const mockContext = createContext({
                $id: 'server-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store)

            pluginSub.plugin(mockContext)

            expect(subscriber.invoke).not.toHaveBeenCalled()
        })

        it('should defer subscriber execution until the hydration scheduler runs on the client', () => {
            const subscriber: PluginSubscriber = {
                name: 'deferred',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }
            const scheduledCallbacks: Array<() => void> = []

            pluginSub = getPluginSubscription([subscriber], {
                runtimeEnvironment: 'client',
                hydrationScheduler: (callback) => {
                    scheduledCallbacks.push(callback)
                },
                subscriberExecution: {
                    deferred: {
                        hydration: 'defer'
                    }
                }
            })

            const mockContext = createContext({
                $id: 'client-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store)

            pluginSub.plugin(mockContext)

            expect(subscriber.invoke).not.toHaveBeenCalled()
            expect(scheduledCallbacks).toHaveLength(1)

            scheduledCallbacks[0]!()

            expect(subscriber.invoke).toHaveBeenCalledWith(mockContext, createTracer)
        })

        it('should scope immediate and deferred action callbacks to their stores across disposal and recreation', () => {
            const scheduled: Array<() => void> = []
            const actionCallbacks = new Map<Store, (params: any) => void>()
            const received: Array<{ store: Store, name: string, result?: unknown, error?: unknown }> = []
            const subscriber: PluginSubscriber = {
                name: 'actions',
                execution: { hydration: 'defer' },
                invoke: vi.fn(({ store }: PiniaPluginContext) => {
                    subscriber.storeOnActionSubscription = () => ({
                        store,
                        callback: ({ name, after, onError }) => {
                            received.push({ store, name })
                            after(result => received.push({ store, name, result }))
                            onError?.(error => received.push({ store, name, error }))
                        }
                    })
                    return true
                })
            }
            pluginSub = getPluginSubscription([subscriber], {
                runtimeEnvironment: 'client',
                hydrationScheduler: run => { scheduled.push(run) }
            })
            const makeStore = (id: string): Store => {
                const store = {
                    $id: id,
                    $state: {},
                    $patch: vi.fn(),
                    $dispose: vi.fn(),
                    $onAction: vi.fn((callback: (params: any) => void) => {
                        actionCallbacks.set(store as unknown as Store, callback)
                    })
                }
                return store as unknown as Store
            }
            const storeA = makeStore('a')
            const storeB = makeStore('b')
            pluginSub.plugin(createContext(storeA))
            pluginSub.plugin(createContext(storeB))
            expect(storeA.$onAction).not.toHaveBeenCalled()
            scheduled[1]!()
            scheduled[0]!()
            expect(storeA.$onAction).toHaveBeenCalledTimes(1)
            expect(storeB.$onAction).toHaveBeenCalledTimes(1)

            const fire = (store: Store, name: string) => {
                const after = vi.fn()
                const onError = vi.fn()
                actionCallbacks.get(store)!({ name, args: [], after, onError })
                after.mock.calls[0]?.[0]('done')
                onError.mock.calls[0]?.[0]('failed')
            }
            fire(storeA, 'first')
            fire(storeB, 'second')
            expect(received).toEqual([
                { store: storeA, name: 'first' },
                { store: storeA, name: 'first', result: 'done' },
                { store: storeA, name: 'first', error: 'failed' },
                { store: storeB, name: 'second' },
                { store: storeB, name: 'second', result: 'done' },
                { store: storeB, name: 'second', error: 'failed' }
            ])

            storeA.$dispose!()
            const recreated = makeStore('a')
            pluginSub.plugin(createContext(recreated))
            scheduled[2]!()
            fire(recreated, 'again')
            expect(received.slice(-3).map(event => event.store)).toEqual([recreated, recreated, recreated])
            expect(recreated.$onAction).toHaveBeenCalledTimes(1)
        })

        it('should retain automatic rollback when an immediate action subscriber is registered first', () => {
            let onActionCallback: ((params: any) => void) | undefined
            const callback = vi.fn()
            const store = {
                $id: 'action-rollback',
                $state: { count: 0 },
                $patch: vi.fn((state: { count: number }) => { store.$state.count = state.count }),
                $onAction: vi.fn((handler: (params: any) => void) => { onActionCallback = handler }),
                $dispose: vi.fn()
            } as unknown as Store
            pluginSub.subscribers = [{
                name: 'immediate',
                invoke: vi.fn().mockReturnValue(true),
                storeOnActionSubscription: () => ({ store, callback })
            }]

            pluginSub.plugin({
                store,
                options: { storeOptions: { rollbackAfterFailure: { fail: [] } } }
            } as PiniaPluginContext)
            const onError = vi.fn()
            onActionCallback!({ name: 'fail', args: [], after: vi.fn(), onError })
            store.$state.count = 10
            onError.mock.calls[0]![0](new Error('failed'))

            expect(callback).toHaveBeenCalledTimes(1)
            expect(store.$state.count).toBe(0)
            expect(store.$patch).toHaveBeenCalledTimes(1)
        })

        it('should deliver immediate and deferred action callbacks once each on the same store', () => {
            const scheduled: Array<() => void> = []
            const immediate = vi.fn()
            const deferred = vi.fn()
            let fireAction: ((params: any) => void) | undefined
            const store = {
                $id: 'mixed',
                $state: {},
                $patch: vi.fn(),
                $dispose: vi.fn(),
                $onAction: vi.fn((callback: (params: any) => void) => { fireAction = callback })
            } as unknown as Store
            pluginSub = getPluginSubscription([
                {
                    name: 'immediate',
                    invoke: vi.fn().mockReturnValue(true),
                    storeOnActionSubscription: () => ({ store, callback: immediate })
                },
                {
                    name: 'deferred',
                    execution: { hydration: 'defer' },
                    invoke: vi.fn().mockReturnValue(true),
                    storeOnActionSubscription: () => ({ store, callback: deferred })
                }
            ], {
                runtimeEnvironment: 'client',
                hydrationScheduler: run => { scheduled.push(run) }
            })

            pluginSub.plugin(createContext(store))
            fireAction!({ name: 'before', args: [], after: vi.fn(), onError: vi.fn() })
            expect(immediate).toHaveBeenCalledOnce()
            expect(deferred).not.toHaveBeenCalled()
            scheduled[0]!()
            fireAction!({ name: 'after', args: [], after: vi.fn(), onError: vi.fn() })
            expect(immediate).toHaveBeenCalledTimes(2)
            expect(deferred).toHaveBeenCalledOnce()
            expect(store.$onAction).toHaveBeenCalledOnce()
        })

        it('should ignore a deferred subscriber queued before its store is disposed and recreated', () => {
            const scheduled: Array<() => void> = []
            const subscriber: PluginSubscriber = {
                name: 'deferred',
                invoke: vi.fn().mockReturnValue(true)
            }
            pluginSub = getPluginSubscription([subscriber], {
                runtimeEnvironment: 'client',
                execution: { hydration: 'defer' },
                hydrationScheduler: run => { scheduled.push(run) }
            })
            const makeStore = () => ({
                $id: 'reused',
                $state: {},
                $patch: vi.fn(),
                $dispose: vi.fn()
            } as unknown as Store)
            const oldStore = makeStore()
            pluginSub.plugin(createContext(oldStore))
            oldStore.$dispose!()
            const newStore = makeStore()
            pluginSub.plugin(createContext(newStore))

            scheduled[0]!()
            expect(subscriber.invoke).not.toHaveBeenCalled()
            scheduled[1]!()
            expect(subscriber.invoke).toHaveBeenCalledOnce()
            expect((subscriber.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0].store).toBe(newStore)
        })

        it('should add reset store callback from subscriber if provided', () => {
            const resetCallback = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'r',
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: resetCallback,
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockContext = createContext({
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            pluginSub.plugin(mockContext)

            expect((pluginSub as any)._resetStoreCallback.get(mockContext.store)).toContain(resetCallback)
        })

        it('should rewrite store $reset method', () => {
            const subscriber: PluginSubscriber = {
                name: 'x',
                invoke: vi.fn(),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0, name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)

            expect(typeof mockStore.$reset).toBe('function')
            expect(mockStore.$reset).not.toEqual(vi.fn())
        })

        it('should handle errors gracefully', () => {
            const errorSubscriber: PluginSubscriber = {
                name: 'err',
                invoke: vi.fn(() => {
                    throw new Error('Test error')
                }),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [errorSubscriber]

            const mockContext = createContext({
                $state: {},
            } as Store)

            expect(() => {
                pluginSub.plugin(mockContext)
            }).not.toThrow()
        })
    })

    describe('subscriptions management', () => {
        beforeEach(() => {
            ; (pluginSub as any)._subscriptions = []
        })

        it('subscriptions getter handles undefined gracefully', () => {
            ; (pluginSub as any)._subscriptions = []
            expect(pluginSub.subscriptions).toBeUndefined()
        })

        it('subscriptions getter should return added subscriptions', () => {
            const subs = { myPlugin: { subscription: { invoke: vi.fn(), name: 'c' } } }
                ; (pluginSub as any)._subscriptions = [subs]

            const got = pluginSub.subscriptions
            expect(got).toBeDefined()
            expect(got).toEqual([subs])
        })

        it('should find subscriptions by plugin name', () => {
            const subs1 = { foo: { subscription: { invoke: vi.fn(), name: 's' } } }
            const subs2 = { bar: { subscription: { invoke: vi.fn(), name: 's2' } } }

                ; (pluginSub as any)._subscriptions = [subs1, subs2]

            const found = pluginSub.subscriptions?.filter(s => Object.prototype.hasOwnProperty.call(s, 'foo'))
            expect(found).toBeDefined()
            expect(found!.length).toBe(1)
            expect(found![0]).toBe(subs1)
        })

        it('subscriptionDelivery should invoke subscribers for stores returned by subscriptions and wire native subscriptions', () => {
            const subscriber: any = {
                name: 'foo',
                invoke: vi.fn().mockReturnValue(true),
            }

            const mutationCb = vi.fn()
            const onActionCb = vi.fn()

            const fakeStoreForMutation: any = {
                $id: 'mut-store',
                $subscribe: (cb: Function) => cb({ type: 'mut' })
            }

            // onAction subscriptions are wired on the plugin-context store
            // (in real usage, the store returned by storeOnActionSubscription is the context store)
            const baseStore: any = {
                $state: {},
                $id: 'base',
                $patch: vi.fn(),
                $reset: vi.fn(),
                $onAction: (cb: Function) => cb({ after: vi.fn(), args: [], name: 'test', onError: vi.fn() })
            }

            // Provide native subscriptions on the subscriber
            subscriber.storeMutationSubscription = () => ({ store: fakeStoreForMutation, callback: mutationCb })
            subscriber.storeOnActionSubscription = () => ({ store: baseStore, callback: onActionCb })

            // Also provide plugin-level subscriptions to invoke
            const pluginSubs = {
                foo: { subscription: { invoke: vi.fn(), name: 'plug' } }
            }

            subscriber.subscriptions = pluginSubs

            pluginSub.subscribers = [subscriber]

            // run plugin which will call subscriptionDelivery and wire native subs
            pluginSub.plugin({ store: baseStore, options: {} } as any)

            // initial invoke should have been called
            expect(subscriber.invoke).toHaveBeenCalled()

            // plugin subscription invoke should have been called
            expect(pluginSubs.foo.subscription.invoke).toHaveBeenCalled()

            // mutation and action callbacks should have been called by the fake stores
            expect(mutationCb).toHaveBeenCalled()
            expect(onActionCb).toHaveBeenCalled()
        })

        it('subscriptionDelivery should invoke subscription for each provided store and merge options correctly', () => {
            const subscriber: any = {
                name: 'foo',
                invoke: vi.fn().mockReturnValue(true),
            }

            const pluginSubscriptionInvoke = vi.fn()

            const extraStore1: any = {
                $id: 's1',
                storeOptions: { per: 's1', key: 'store' }
            }

            const extraStore2: any = {
                $id: 's2'
            }

            const pluginSubs = {
                foo: {
                    subscription: { invoke: pluginSubscriptionInvoke, name: 'plug' },
                    subscriptionOptions: { subOnly: true, key: 'sub' },
                    stores: [extraStore1, extraStore2]
                }
            }

            subscriber.subscriptions = pluginSubs

            pluginSub.subscribers = [subscriber]

            const baseStore: any = { $state: {}, $id: 'base', $patch: vi.fn(), $reset: vi.fn() }

            const baseOptions = { key: 'base', baseOnly: true }

            // run plugin which will call subscriptionDelivery for plugin-level and each store
            pluginSub.plugin({ store: baseStore, options: baseOptions } as any)

            expect(pluginSubscriptionInvoke).toHaveBeenCalledTimes(3)

            const calls = pluginSubscriptionInvoke.mock.calls

            // first call: plugin-level invoke with merged options (subscriptionOptions override base)
            expect(calls[0]![0].store).toBe(baseStore)
            expect(calls[0]![0].options).toEqual(expect.objectContaining({
                key: 'base',
                baseOnly: true,
                storeOptions: { key: 'sub', subOnly: true }
            }))

            // second call: per-store invoke, storeOptions override subscriptionOptions and base
            expect(calls[1]![0].store).toBe(extraStore1)
            expect(calls[1]![0].options).toEqual(expect.objectContaining({
                key: 'store',
                baseOnly: true,
                storeOptions: { key: 'sub', subOnly: true },
                per: 's1'
            }))

            // third call: per-store invoke without storeOptions
            expect(calls[2]![0].store).toBe(extraStore2)
            expect(calls[2]![0].options).toEqual(expect.objectContaining({
                "baseOnly": true,
                "key": "base",
                "storeOptions": {
                    "key": "sub",
                    "subOnly": true,
                },
            }))
        })

        it('should defer nested subscription delivery until hydration scheduler runs on the client', () => {
            const nestedInvoke = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            execution: { hydration: 'defer' },
                            invoke: nestedInvoke
                        }
                    }
                }
            }
            const scheduledCallbacks: Array<() => void> = []

            pluginSub = getPluginSubscription([subscriber], {
                runtimeEnvironment: 'client',
                hydrationScheduler: (callback) => {
                    scheduledCallbacks.push(callback)
                }
            })

            const baseStore: any = {
                $id: 'deferred-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn()
            }

            pluginSub.plugin({ store: baseStore, options: {} } as any)

            expect(subscriber.invoke).toHaveBeenCalledOnce()
            expect(nestedInvoke).not.toHaveBeenCalled()
            expect(scheduledCallbacks).toHaveLength(1)

            scheduledCallbacks[0]!()

            expect(nestedInvoke).toHaveBeenCalledWith(
                { store: baseStore, options: { storeOptions: {} } }
            )
        })

        it('should call afterHydration only after hydrate resolves', async () => {
            const order: string[] = []
            const subscriber: PluginSubscriber = {
                name: 'async-hydration',
                invoke: vi.fn().mockReturnValue(true),
                hydrate: vi.fn().mockImplementation(async () => {
                    order.push('hydrate')
                }),
                afterHydration: vi.fn().mockImplementation(() => {
                    order.push('afterHydration')
                }),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'hydrate-store',
                $state: { count: 0 },
                $patch: vi.fn(),
                $reset: vi.fn(),
                $dispose: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)
            await Promise.resolve()
            await Promise.resolve()

            expect(order).toEqual(['hydrate', 'afterHydration'])
        })

        it('should clear delivered tracking when a store is disposed', () => {
            const subscriber: PluginSubscriber = {
                name: 'dispose-tracker',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'tracked-store',
                $state: { count: 0 },
                $patch: vi.fn(),
                $reset: vi.fn(),
                $dispose: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            const subscriberKey = 'dispose-tracker-tracked-store'
            expect((pluginSub as any)._subscribersDelivered.has(subscriberKey)).toBe(true)

            mockStore.$dispose = vi.fn(() => {
                ; (pluginSub as any).clearStoreTracking(mockStore)
            })
            mockStore.$dispose()

            expect((pluginSub as any)._subscribersDelivered.has(subscriberKey)).toBe(false)
        })
    })

    describe('$reset rewritten method', () => {
        it('should execute all reset store callbacks when $reset is called', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()

            const subscriber: PluginSubscriber = {
                name: 'a',
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: callback1,
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)
                ; (pluginSub as any).addResetStoreCallback(mockStore, callback2)

            // Call the new $reset
            mockStore.$reset!()

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
        })

        it('should restore initial state with $patch', () => {
            const subscriber: PluginSubscriber = {
                name: 'b',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0, name: 'initial' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)

                // Simulate state change by modifying $state
                ; (mockStore.$state as any).count = 5
                ; (mockStore.$state as any).name = 'changed'

            // Call the new $reset
            mockStore.$reset!()

            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should skip properties starting with $ or _', () => {
            const subscriber: PluginSubscriber = {
                name: 'c',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0, _private: 'hidden' },
                $reset: vi.fn(),
                $patch: vi.fn(),
                $subscribe: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)

            // Call the new $reset
            mockStore.$reset!()

            // Properties starting with $ or _ should be skipped
            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should use initial state value if available', () => {
            const subscriber: PluginSubscriber = {
                name: 's',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 10, name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)

                // Change state via $state
                ; (mockStore.$state as any).count = 999

            // Call the new $reset
            mockStore.$reset!()

            expect(mockStore.$patch).toHaveBeenCalledWith(
                expect.objectContaining({ count: 10, name: 'test' })
            )
        })

        it('should preserve structured values when restoring the initial state', () => {
            const subscriber: PluginSubscriber = {
                name: 'structured-reset',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            const initialDate = new Date('2024-01-01T00:00:00.000Z')
            const snapshot = { count: 1, meta: { createdAt: initialDate, tags: ['a', 'b'] } }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: snapshot,
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            pluginSub.plugin(createContext(mockStore))

                ; (mockStore.$state as any).meta.createdAt = new Date('2024-02-02T00:00:00.000Z')
                ; (mockStore.$state as any).meta.tags = ['x']

            mockStore.$reset!()

            const resetState = (mockStore.$patch as any).mock.calls[0][0]
            expect(resetState.meta.createdAt instanceof Date).toBe(true)
            expect(resetState.meta.createdAt.getTime()).toBe(initialDate.getTime())
            expect(resetState.meta.tags).toEqual(['a', 'b'])
        })
    })

    describe('integration tests', () => {
        it('should handle complete plugin lifecycle', () => {
            const resetCallback = vi.fn()
            const subscriber1: PluginSubscriber = {
                name: 'a',
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: resetCallback,
                subscriptions: undefined,
            }
            const subscriber2: PluginSubscriber = {
                name: 'b',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber1, subscriber2]

            const mockStore = {
                $state: { count: 0, data: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            // Initialize plugin
            pluginSub.plugin(mockContext)

            expect(subscriber1.invoke).toHaveBeenCalled()
            expect(subscriber2.invoke).toHaveBeenCalled()

            // Simulate reset
            mockStore.$reset!()

            expect(resetCallback).toHaveBeenCalledWith(mockStore)
            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should handle multiple stores with different states', () => {
            const subscriber: PluginSubscriber = {
                name: 'multi',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const store1 = {
                $id: 'store1',
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const store2 = {
                $id: 'store2',
                $state: { name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const context1 = createContext(store1)

            const context2 = createContext(store2)

            pluginSub.plugin(context1)
            pluginSub.plugin(context2)

            expect(subscriber.invoke).toHaveBeenCalledTimes(2)
            expect(subscriber.invoke).toHaveBeenNthCalledWith(1, context1, createTracer)
            expect(subscriber.invoke).toHaveBeenNthCalledWith(2, context2, createTracer)
        })
    })

    describe('subscriptionDelivery coverage', () => {
        it('should skip nested subscriptions restricted to another environment', () => {
            const nestedInvoke = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            execution: { environment: 'server' },
                            invoke: nestedInvoke
                        }
                    }
                }
            }

            pluginSub = getPluginSubscription([subscriber], { runtimeEnvironment: 'client' })

            const mockStore = {
                $id: 'env-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(subscriber.invoke).toHaveBeenCalledOnce()
            expect(nestedInvoke).not.toHaveBeenCalled()
        })

        it('should deliver a nested subscription only once for the same store', () => {
            const nestedInvoke = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: { name: 'child', invoke: nestedInvoke }
                    }
                }
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'dedup-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(nestedInvoke).toHaveBeenCalledTimes(1)
                ; (pluginSub as any).subscriptionDelivery(
                    { store: mockStore, options: {} },
                    subscriber.subscriptions
                )

            expect(nestedInvoke).toHaveBeenCalledTimes(1)
        })

        it('should catch nested subscription errors without breaking delivery', () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            invoke: vi.fn(() => { throw new Error('subscription failure') })
                        }
                    }
                }
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'failing-sub-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            expect(() => pluginSub.plugin({ store: mockStore, options: {} } as any)).not.toThrow()
            expect(consoleLogSpy).toHaveBeenCalled()
            consoleLogSpy.mockRestore()
        })

        it('should invoke a nested subscription for each store when stores is a single-item array', () => {
            const nestedInvoke = vi.fn()
            const extraStore = { $id: 'extra', storeOptions: { scoped: true } } as unknown as Store
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: { name: 'child', invoke: nestedInvoke },
                        stores: [extraStore]
                    }
                }
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'multi-target-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(nestedInvoke).toHaveBeenCalledTimes(2)
            expect(nestedInvoke.mock.calls[1]![0].store).toBe(extraStore)
        })

        it('should deliver a deferred nested subscription through a subscriber-level hydration scheduler', () => {
            const nestedInvoke = vi.fn()
            const scheduledCallbacks: Array<() => void> = []
            const subscriberScheduler = vi.fn((callback: () => void) => { scheduledCallbacks.push(callback) })
            const subscriber: PluginSubscriber = {
                name: 'root',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            hydrationScheduler: subscriberScheduler,
                            execution: { hydration: 'defer' },
                            invoke: nestedInvoke
                        }
                    }
                }
            }

            pluginSub = getPluginSubscription([subscriber], { runtimeEnvironment: 'client' })

            const mockStore = {
                $id: 'subscriber-scheduler-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(nestedInvoke).not.toHaveBeenCalled()
            expect(subscriberScheduler).toHaveBeenCalledTimes(1)
            expect((pluginSub as any)._subscriptionsScheduled.has('child-subscriber-scheduler-store')).toBe(true)

            scheduledCallbacks[0]!()

            expect(nestedInvoke).toHaveBeenCalledTimes(1)
            expect((pluginSub as any)._subscriptionsScheduled.has('child-subscriber-scheduler-store')).toBe(false)
        })
    })

    describe('executeStoreOnActionSubscription coverage', () => {
        it('should register rollback callbacks on $onAction when the store has rollback snapshots', () => {
            const subscriber: PluginSubscriber = {
                name: 'rollback-trigger',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }
            let onActionCallback: ((params: any) => void) | undefined
            const mockStore = {
                $id: 'rollback-store',
                $state: { count: 0 },
                $patch: vi.fn(),
                $reset: vi.fn(),
                $onAction: vi.fn((cb: (params: any) => void) => { onActionCallback = cb })
            } as unknown as Store

            pluginSub.subscribers = [subscriber]
            pluginSub.plugin({
                store: mockStore,
                options: { storeOptions: { rollbackAfterFailure: { update: ['count'] } } }
            } as any)

            expect(mockStore.$onAction).toHaveBeenCalledTimes(1)

            const after = vi.fn()
            const onError = vi.fn()
            onActionCallback!({ after, args: [], name: 'update', onError })

            expect(after).toHaveBeenCalledTimes(1)
            expect(onError).toHaveBeenCalledTimes(1)
        })

        it('should skip $onAction wiring when there are no subscriptions and no rollback snapshots', () => {
            const subscriber: PluginSubscriber = {
                name: 'no-action-subs',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }
            const mockStore = {
                $id: 'no-action-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
                $onAction: vi.fn()
            } as unknown as Store

            pluginSub.subscribers = [subscriber]
            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(mockStore.$onAction).not.toHaveBeenCalled()
        })
    })

    describe('async hydration error handling', () => {
        const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0))

        it('should log hydrate promise rejections without breaking registration', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const afterHydration = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'async-hydrate-failure',
                invoke: vi.fn().mockReturnValue(true),
                hydrate: vi.fn(() => Promise.reject(new Error('async hydrate failure'))),
                afterHydration,
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'async-hydrate-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)
            await flushMicrotasks()

            expect(afterHydration).not.toHaveBeenCalled()
            expect(consoleLogSpy).toHaveBeenCalled()
            consoleLogSpy.mockRestore()
        })

        it('should log afterHydration promise rejections without breaking registration', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const subscriber: PluginSubscriber = {
                name: 'async-after-hydration-failure',
                invoke: vi.fn().mockReturnValue(true),
                afterHydration: vi.fn(() => Promise.reject(new Error('async afterHydration failure'))),
                subscriptions: undefined,
            }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $id: 'async-after-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)
            await flushMicrotasks()

            expect(consoleLogSpy).toHaveBeenCalled()
            consoleLogSpy.mockRestore()
        })
    })

    describe('registerStoreCleanup coverage', () => {
        it('should not wrap $dispose twice when plugin is called again for the same store', () => {
            const subscriber: PluginSubscriber = {
                name: 'rewire',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }
            const originalDispose = vi.fn()
            const mockStore = {
                $id: 'rewire-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn(),
                $dispose: originalDispose
            } as unknown as Store

            pluginSub.subscribers = [subscriber]
            pluginSub.plugin({ store: mockStore, options: {} } as any)

            const firstWrappedDispose = mockStore.$dispose

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect(mockStore.$dispose).toBe(firstWrappedDispose)

            mockStore.$dispose!()

            expect(originalDispose).toHaveBeenCalledTimes(1)
        })

        it('should leave stores without $dispose untouched', () => {
            const subscriber: PluginSubscriber = {
                name: 'no-dispose',
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: undefined,
            }
            const mockStore = {
                $id: 'no-dispose-store',
                $state: {},
                $patch: vi.fn(),
                $reset: vi.fn()
            } as unknown as Store

            pluginSub.subscribers = [subscriber]

            expect(() => pluginSub.plugin({ store: mockStore, options: {} } as any)).not.toThrow()
            expect(mockStore.$dispose).toBeUndefined()
            expect((mockStore as any).__piniaPluginSubscriptionDisposed).toBeUndefined()
        })
    })

    describe('defaultHydrationScheduler', () => {
        it('should run the callback through setTimeout', async () => {
            vi.useFakeTimers()
            try {
                const callback = vi.fn()

                    ; (pluginSub as any)._hydrationScheduler(callback)

                expect(callback).not.toHaveBeenCalled()

                await vi.advanceTimersByTimeAsync(0)

                expect(callback).toHaveBeenCalledTimes(1)
            } finally {
                vi.useRealTimers()
            }
        })
    })
})
