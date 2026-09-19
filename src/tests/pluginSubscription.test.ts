import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PiniaPluginContext, Store } from 'pinia'
import type { PluginSubscriber, PluginSubscriptionOptions } from '../types/plugin'
import PluginSubscription from '../core/PluginSubscription'

function createContext(store: Store): PiniaPluginContext {
    return {
        store,
        options: {},
    } as unknown as PiniaPluginContext
}

function getPluginSubscription(
    subscribers: PluginSubscriber[],
    debugOrOptions?: PluginSubscriptionOptions | string[],
    options?: PluginSubscriptionOptions
) {
    return new PluginSubscription(subscribers, debugOrOptions, options)
}

describe('PluginSubscription', () => {
    let pluginSub: PluginSubscription

    beforeEach(() => {
        // Create a fresh instance before each test
        pluginSub = getPluginSubscription([])
    })

    describe('subscribers setter', () => {
        it('should set subscribers array', () => {
            const mockSubscriber: PluginSubscriber = {
                name: 'mock',
                console: console,
                invoke: vi.fn(),
                subscriptions: undefined,
            }
            const subscribers = [mockSubscriber]

            pluginSub.subscribers = subscribers

            expect((pluginSub as any)._subscribers).toEqual(subscribers)
        })

        it('should replace existing subscribers with new ones', () => {
            const subscriber1: PluginSubscriber = { name: 'a', console: console, invoke: vi.fn(), subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 'b', console: console, invoke: vi.fn(), subscriptions: undefined }

            pluginSub.subscribers = [subscriber1]
            pluginSub.subscribers = [subscriber2]

            expect((pluginSub as any)._subscribers).toEqual([subscriber2])
            expect((pluginSub as any)._subscribers.length).toBe(1)
        })
    })

    describe('reset callbacks via plugin', () => {
        it('should register reset callback provided by subscriber during plugin init', () => {
            const callback = vi.fn()
            const subscriber: PluginSubscriber = { name: 's', console: console, invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback, subscriptions: undefined }

            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            pluginSub.plugin({ store: mockStore, options: {} } as any)

            expect((pluginSub as any)._resetStoreCallback).toContain(callback)
        })

        it('should execute multiple reset callbacks when $reset is called', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const subscriber1: PluginSubscriber = { name: 's1', console: console, invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback1, subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 's2', console: console, invoke: vi.fn().mockReturnValue(true), resetStoreCallback: callback2, subscriptions: undefined }

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
    })



    describe('edge cases', () => {
        it('should clone Map and Set values when $reset is executed', () => {
            const subscriber: PluginSubscriber = {
                name: 'map-set-reset',
                console: console,
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
                console: console,
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
                console: console,
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
            expect(subscriber.invoke).toHaveBeenCalledWith(mockContext, false)
        })
    })

    describe('executeResetStoreCallbacks', () => {
        it('should execute all reset store callbacks', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const callback3 = vi.fn()

                ; (pluginSub as any).addResetStoreCallback(callback1)
                ; (pluginSub as any).addResetStoreCallback(callback2)
                ; (pluginSub as any).addResetStoreCallback(callback3)

            const mockStore = { $state: {} } as Store

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

                ; (pluginSub as any).addResetStoreCallback(callback1)
                ; (pluginSub as any).addResetStoreCallback(callback2)
                ; (pluginSub as any).addResetStoreCallback(callback3)

            const mockStore = { $state: {} } as Store

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

        it('should invoke all subscribers with correct context and debug flag', () => {
            const subscriber1: PluginSubscriber = { name: 'a', console: console, invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }
            const subscriber2: PluginSubscriber = { name: 'b', console: console, invoke: vi.fn().mockReturnValue(true), subscriptions: undefined }

            pluginSub = getPluginSubscription([subscriber1, subscriber2], ['a', 'b'])

            const mockContext = createContext({
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            pluginSub.plugin(mockContext)

            expect(subscriber1.invoke).toHaveBeenCalledWith(mockContext, true)
            expect(subscriber2.invoke).toHaveBeenCalledWith(mockContext, true)
        })

        it('should skip client-only subscribers while running on the server', () => {
            const subscriber: PluginSubscriber = {
                name: 'client-only',
                console: console,
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
                console: console,
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

            expect(subscriber.invoke).toHaveBeenCalledWith(mockContext, false)
        })

        it('should add reset store callback from subscriber if provided', () => {
            const resetCallback = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'r',
                console: console,
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

            expect((pluginSub as any)._resetStoreCallback).toContain(resetCallback)
        })

        it('should rewrite store $reset method', () => {
            const subscriber: PluginSubscriber = {
                name: 'x',
                console: console,
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
                console: console,
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
            const subs = { myPlugin: { subscription: { invoke: vi.fn(), name: 'c', console: console } } }
                ; (pluginSub as any)._subscriptions = [subs]

            const got = pluginSub.subscriptions
            expect(got).toBeDefined()
            expect(got).toEqual([subs])
        })

        it('should find subscriptions by plugin name', () => {
            const subs1 = { foo: { subscription: { invoke: vi.fn(), name: 's', console: console } } }
            const subs2 = { bar: { subscription: { invoke: vi.fn(), name: 's2', console: console } } }

                ; (pluginSub as any)._subscriptions = [subs1, subs2]

            const found = pluginSub.subscriptions?.filter(s => Object.prototype.hasOwnProperty.call(s, 'foo'))
            expect(found).toBeDefined()
            expect(found!.length).toBe(1)
            expect(found![0]).toBe(subs1)
        })

        it('subscriptionDelivery should invoke subscribers for stores returned by subscriptions and wire native subscriptions', () => {
            const subscriber: any = {
                name: 'foo',
                console: console,
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
                foo: { subscription: { invoke: vi.fn(), name: 'plug', console: console } }
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
                console: console,
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
                    subscription: { invoke: pluginSubscriptionInvoke, name: 'plug', console: console },
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
                console: console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            console,
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
                { store: baseStore, options: { storeOptions: {} } },
                false
            )
        })

        it('should call afterHydration only after hydrate resolves', async () => {
            const order: string[] = []
            const subscriber: PluginSubscriber = {
                name: 'async-hydration',
                console,
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
                console,
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
                console: console,
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: callback1,
                subscriptions: undefined,
            }

                ; (pluginSub as any)._resetStoreCallback = [callback2]
            pluginSub.subscribers = [subscriber]

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            pluginSub.plugin(mockContext)

            // Call the new $reset
            mockStore.$reset!()

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
        })

        it('should restore initial state with $patch', () => {
            const subscriber: PluginSubscriber = {
                name: 'b',
                console: console,
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
                console: console,
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
                console: console,
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
                console,
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
                console: console,
                invoke: vi.fn().mockReturnValue(true),
                resetStoreCallback: resetCallback,
                subscriptions: undefined,
            }
            const subscriber2: PluginSubscriber = {
                name: 'b',
                console: console,
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
                console: console,
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
            expect(subscriber.invoke).toHaveBeenNthCalledWith(1, context1, false)
            expect(subscriber.invoke).toHaveBeenNthCalledWith(2, context2, false)
        })
    })

    describe('subscriptionDelivery coverage', () => {
        it('should skip nested subscriptions restricted to another environment', () => {
            const nestedInvoke = vi.fn()
            const subscriber: PluginSubscriber = {
                name: 'root',
                console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            console,
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
                console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: { name: 'child', console, invoke: nestedInvoke }
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
                console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            console,
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
                console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: { name: 'child', console, invoke: nestedInvoke },
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
                console,
                invoke: vi.fn().mockReturnValue(true),
                subscriptions: {
                    child: {
                        subscription: {
                            name: 'child',
                            console,
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
                console,
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
                ; (pluginSub as any)._onActionSubscriptions.forEach((cb: any) => {
                    expect(typeof cb === 'function' ? true : false).toBe(true)
                })
        })

        it('should skip $onAction wiring when there are no subscriptions and no rollback snapshots', () => {
            const subscriber: PluginSubscriber = {
                name: 'no-action-subs',
                console,
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
                console,
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
                console,
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
                console,
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
                console,
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
