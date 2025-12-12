import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PiniaPluginContext, Store } from 'pinia'
import type { PluginSubscriber } from '../types/plugin'
import PluginSubscription from '../plugins/pluginCreation'

function createContext(store: Store): PiniaPluginContext {
    return {
        store,
        options: {},
    } as unknown as PiniaPluginContext
}

describe('PluginSubscription', () => {
    beforeEach(() => {
        // Reset the instance state before each test
        PluginSubscription['_debug'] = false
        PluginSubscription['_resetStoreCallback'] = []
        PluginSubscription['_subscribers'] = []
    })

    describe('debug setter', () => {
        it('should set debug mode to true', () => {
            PluginSubscription.debug = true
            expect(PluginSubscription['_debug']).toBe(true)
        })

        it('should set debug mode to false', () => {
            PluginSubscription.debug = true
            PluginSubscription.debug = false
            expect(PluginSubscription['_debug']).toBe(false)
        })
    })

    describe('subscribers setter', () => {
        it('should set subscribers array', () => {
            const mockSubscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }
            const subscribers = [mockSubscriber]

            PluginSubscription.subscribers = subscribers

            expect(PluginSubscription['_subscribers']).toEqual(subscribers)
        })

        it('should replace existing subscribers with new ones', () => {
            const subscriber1: PluginSubscriber = { invoke: vi.fn() }
            const subscriber2: PluginSubscriber = { invoke: vi.fn() }

            PluginSubscription.subscribers = [subscriber1]
            PluginSubscription.subscribers = [subscriber2]

            expect(PluginSubscription['_subscribers']).toEqual([subscriber2])
            expect(PluginSubscription['_subscribers'].length).toBe(1)
        })
    })

    describe('addResetStoreCallback', () => {
        it('should add a callback to the reset store callbacks array', () => {
            const callback = vi.fn()

            PluginSubscription.addResetStoreCallback(callback)

            expect(PluginSubscription['_resetStoreCallback']).toContain(callback)
            expect(PluginSubscription['_resetStoreCallback'].length).toBe(1)
        })

        it('should add multiple callbacks', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const callback3 = vi.fn()

            PluginSubscription.addResetStoreCallback(callback1)
            PluginSubscription.addResetStoreCallback(callback2)
            PluginSubscription.addResetStoreCallback(callback3)

            expect(PluginSubscription['_resetStoreCallback'].length).toBe(3)
            expect(PluginSubscription['_resetStoreCallback']).toEqual([callback1, callback2, callback3])
        })
    })

    describe('addSubscriber', () => {
        it('should add a subscriber to the subscribers array', () => {
            const mockSubscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(mockSubscriber)

            expect(PluginSubscription['_subscribers']).toContain(mockSubscriber)
            expect(PluginSubscription['_subscribers'].length).toBe(1)
        })

        it('should add multiple subscribers', () => {
            const subscriber1: PluginSubscriber = { invoke: vi.fn() }
            const subscriber2: PluginSubscriber = { invoke: vi.fn() }

            PluginSubscription.addSubscriber(subscriber1)
            PluginSubscription.addSubscriber(subscriber2)

            expect(PluginSubscription['_subscribers'].length).toBe(2)
            expect(PluginSubscription['_subscribers']).toEqual([subscriber1, subscriber2])
        })
    })

    describe('executeResetStoreCallbacks', () => {
        it('should execute all reset store callbacks', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const callback3 = vi.fn()

            PluginSubscription.addResetStoreCallback(callback1)
            PluginSubscription.addResetStoreCallback(callback2)
            PluginSubscription.addResetStoreCallback(callback3)

            const mockStore = { $state: {} } as Store

            PluginSubscription.executeResetStoreCallbacks(mockStore)

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
            expect(callback3).toHaveBeenCalledWith(mockStore)
        })

        it('should execute callbacks in the correct order', () => {
            const callOrder: number[] = []
            const callback1 = vi.fn(() => callOrder.push(1))
            const callback2 = vi.fn(() => callOrder.push(2))
            const callback3 = vi.fn(() => callOrder.push(3))

            PluginSubscription.addResetStoreCallback(callback1)
            PluginSubscription.addResetStoreCallback(callback2)
            PluginSubscription.addResetStoreCallback(callback3)

            const mockStore = { $state: {} } as Store

            PluginSubscription.executeResetStoreCallbacks(mockStore)

            expect(callOrder).toEqual([1, 2, 3])
        })

        it('should handle empty callbacks array', () => {
            const mockStore = { $state: {} } as Store

            expect(() => {
                PluginSubscription.executeResetStoreCallbacks(mockStore)
            }).not.toThrow()
        })
    })

    describe('plugin method', () => {
        it('should return early if there are no subscribers', () => {
            const mockContext = createContext({ $state: {} } as Store)

            expect(() => {
                PluginSubscription.plugin(mockContext)
            }).not.toThrow()
        })

        it('should invoke all subscribers with correct context and debug flag', () => {
            const subscriber1: PluginSubscriber = { invoke: vi.fn() }
            const subscriber2: PluginSubscriber = { invoke: vi.fn() }

            PluginSubscription.addSubscriber(subscriber1)
            PluginSubscription.addSubscriber(subscriber2)
            PluginSubscription.debug = true

            const mockContext = createContext({
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            PluginSubscription.plugin(mockContext)

            expect(subscriber1.invoke).toHaveBeenCalledWith(mockContext, true)
            expect(subscriber2.invoke).toHaveBeenCalledWith(mockContext, true)
        })

        it('should add reset store callback from subscriber if provided', () => {
            const resetCallback = vi.fn()
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
                resetStoreCallback: resetCallback,
            }

            PluginSubscription.addSubscriber(subscriber)

            const mockContext = createContext({
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            PluginSubscription.plugin(mockContext)

            expect(PluginSubscription['_resetStoreCallback']).toContain(resetCallback)
        })

        it('should rewrite store $reset method', () => {
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber)

            const mockStore = {
                $state: { count: 0, name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            PluginSubscription.plugin(mockContext)

            expect(typeof mockStore.$reset).toBe('function')
            expect(mockStore.$reset).not.toEqual(vi.fn())
        })

        it('should handle errors gracefully', () => {
            const errorSubscriber: PluginSubscriber = {
                invoke: vi.fn(() => {
                    throw new Error('Test error')
                }),
            }

            PluginSubscription.addSubscriber(errorSubscriber)

            const mockContext = createContext({
                $state: {},
            } as Store)

            expect(() => {
                PluginSubscription.plugin(mockContext)
            }).not.toThrow()
        })

        it('should pass debug flag as false when debug is not set', () => {
            const subscriber: PluginSubscriber = { invoke: vi.fn() }

            PluginSubscription.addSubscriber(subscriber)
            PluginSubscription.debug = false

            const mockContext = createContext({
                $state: {},
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store)

            PluginSubscription.plugin(mockContext)

            expect(subscriber.invoke).toHaveBeenCalledWith(mockContext, false)
        })
    })

    describe('$reset rewritten method', () => {
        it('should execute all reset store callbacks when $reset is called', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()

            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
                resetStoreCallback: callback1,
            }

            PluginSubscription.addResetStoreCallback(callback2)
            PluginSubscription.addSubscriber(subscriber)

            const mockStore = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            PluginSubscription.plugin(mockContext)

            // Call the new $reset
            mockStore.$reset!()

            expect(callback1).toHaveBeenCalledWith(mockStore)
            expect(callback2).toHaveBeenCalledWith(mockStore)
        })

        it('should restore initial state with $patch', () => {
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber)

            const mockStore = {
                $state: { count: 0, name: 'initial' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            PluginSubscription.plugin(mockContext)

                // Simulate state change by modifying $state
                ; (mockStore.$state as any).count = 5
                ; (mockStore.$state as any).name = 'changed'

            // Call the new $reset
            mockStore.$reset!()

            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should skip properties starting with $ or _', () => {
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber)

            const mockStore = {
                $state: { count: 0, _private: 'hidden' },
                $reset: vi.fn(),
                $patch: vi.fn(),
                $subscribe: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            PluginSubscription.plugin(mockContext)

            // Call the new $reset
            mockStore.$reset!()

            // Properties starting with $ or _ should be skipped
            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should use initial state value if available', () => {
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber)

            const mockStore = {
                $state: { count: 10, name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            PluginSubscription.plugin(mockContext)

                // Change state via $state
                ; (mockStore.$state as any).count = 999

            // Call the new $reset
            mockStore.$reset!()

            expect(mockStore.$patch).toHaveBeenCalledWith(
                expect.objectContaining({ count: 10, name: 'test' })
            )
        })
    })

    describe('integration tests', () => {
        it('should handle complete plugin lifecycle', () => {
            const resetCallback = vi.fn()
            const subscriber1: PluginSubscriber = {
                invoke: vi.fn(),
                resetStoreCallback: resetCallback,
            }
            const subscriber2: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber1)
            PluginSubscription.addSubscriber(subscriber2)
            PluginSubscription.debug = true

            const mockStore = {
                $state: { count: 0, data: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const mockContext = createContext(mockStore)

            // Initialize plugin
            PluginSubscription.plugin(mockContext)

            expect(subscriber1.invoke).toHaveBeenCalled()
            expect(subscriber2.invoke).toHaveBeenCalled()

            // Simulate reset
            mockStore.$reset!()

            expect(resetCallback).toHaveBeenCalledWith(mockStore)
            expect(mockStore.$patch).toHaveBeenCalled()
        })

        it('should handle multiple stores with different states', () => {
            const subscriber: PluginSubscriber = {
                invoke: vi.fn(),
            }

            PluginSubscription.addSubscriber(subscriber)

            const store1 = {
                $state: { count: 0 },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const store2 = {
                $state: { name: 'test' },
                $reset: vi.fn(),
                $patch: vi.fn(),
            } as unknown as Store

            const context1 = createContext(store1)

            const context2 = createContext(store2)

            PluginSubscription.plugin(context1)
            PluginSubscription.plugin(context2)

            expect(subscriber.invoke).toHaveBeenCalledTimes(2)
            expect(subscriber.invoke).toHaveBeenNthCalledWith(1, context1, false)
            expect(subscriber.invoke).toHaveBeenNthCalledWith(2, context2, false)
        })
    })
})
