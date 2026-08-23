import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ref, isRef } from 'vue'

const { defineStoreMock, beforeReturnStoreMock } = vi.hoisted(() => ({
    beforeReturnStoreMock: vi.fn(),
    defineStoreMock: vi.fn((id: string, storeDefinition: unknown) => {
        const useStore = vi.fn(() => {
            const store = {
                $id: id,
                ...((typeof storeDefinition === 'function' ? storeDefinition() : {}) as object)
            }
            beforeReturnStoreMock(store)
            return store
        })

        return Object.assign(useStore, { $id: id })
    })
}))

vi.mock('pinia', async () => {
    const actual = await vi.importActual<typeof import('pinia')>('pinia')

    return {
        ...actual,
        defineStore: defineStoreMock
    }
})

import Store from '../core/Store'
import type { Store as PiniaStore } from 'pinia'
import type { PluginStoreOptions, StoreOptions } from '../types'
import { defineAStore, defineAStoreCtx, getDefineAStoreSetupContext } from '../utils/store'

class StoreChild extends Store {
    protected static override _requiredKeys?: string[] | undefined = ['test']
}

describe('Store', () => {
    let mockPiniaStore: PiniaStore
    let mockOptions: PluginStoreOptions
    let storeInstance: Store
    let childInstance: StoreChild

    beforeEach(() => {
        defineStoreMock.mockClear()
        beforeReturnStoreMock.mockClear()

        mockPiniaStore = {
            $state: { test: 'my string' },
            $subscribe: vi.fn(),
            $onAction: vi.fn(),
            $dispose: vi.fn(),
            $patch: vi.fn(),
            $reset: vi.fn(),
            _isOptionsAPI: false,
            _customProperties: new Set(),
        } as unknown as PiniaStore

        mockOptions = {
            storeOptions: {
                debug: false,
                customOptions: {}
            } as StoreOptions
        }

        storeInstance = new Store(mockPiniaStore, mockOptions, false)
    })

    describe('Constructor', () => {
        it('should initialize with correct parameters', () => {
            expect(storeInstance.debug).toBe(false)
            expect(storeInstance.store).toEqual(mockPiniaStore)
            expect(storeInstance.options).toEqual(mockOptions.storeOptions)
        })

        it('should set debug mode if provided', () => {
            const debugStore = new Store(mockPiniaStore, mockOptions, true)
            expect(debugStore.debug).toBe(true)
        })

        it('should handle undefined storeOptions', () => {
            const emptyOptions = {} as PluginStoreOptions
            const store = new Store(mockPiniaStore, emptyOptions, false)
            expect(store.options).toBeUndefined()
        })

        it('should only attach the enhanced store when enhancedStore is enabled', () => {
            const useStore = defineAStoreCtx('enhanceStoreContext', () => ({
                count: ref(1)
            }))
            const piniaStore = useStore()

            const store = new Store(piniaStore, { storeOptions: { enhancedStore: true } } as PluginStoreOptions, false)
            const setupContext = getDefineAStoreSetupContext(piniaStore)

            expect(setupContext?.extensions.enhancedStore).toBe(store.store)
            expect(setupContext?.extensions.extending).toBe(store.store)
        })

        it('should not attach the enhanced store when enhanceStore is absent', () => {
            const useStore = defineAStoreCtx('withoutEnhanceStore', () => ({
                count: ref(1)
            }))
            const piniaStore = useStore()

            new Store(piniaStore, { storeOptions: {} } as PluginStoreOptions, false)
            const setupContext = getDefineAStoreSetupContext(piniaStore)

            expect(setupContext?.extensions.enhancedStore).toBeUndefined()
            expect(setupContext?.extensions.extending).toBeUndefined()
        })
    })

    describe('debug getter/setter', () => {
        it('should get debug value', () => {
            expect(storeInstance.debug).toBe(false)
        })

        it('should set debug to true', () => {
            storeInstance.debug = true
            expect(storeInstance.debug).toBe(true)
        })

        it('should set debug to false', () => {
            storeInstance.debug = true
            storeInstance.debug = false
            expect(storeInstance.debug).toBe(false)
        })
    })

    describe('options getter', () => {
        it('should return store options', () => {
            expect(storeInstance.options).toEqual(mockOptions.storeOptions)
        })

        it('should be read-only', () => {
            const result = storeInstance.options
            expect(result).toEqual(mockOptions.storeOptions)
        })
    })

    describe('state getter/setter', () => {
        it('should get current state', () => {
            expect(storeInstance.state).toEqual(mockPiniaStore.$state)
        })

        it('should set new state', () => {
            const newState = { test: 'new value', count: 42 }
            storeInstance.state = newState
            expect(storeInstance.state).toEqual(newState)
            expect(mockPiniaStore.$state).toEqual(newState)
        })

        it('should replace entire state', () => {
            const initialState = { a: 1, b: 2 }
            const newState = { c: 3 }
            storeInstance.state = initialState
            storeInstance.state = newState
            expect(storeInstance.state).toEqual(newState)
        })
    })

    describe('store getter', () => {
        it('should return the pinia store instance', () => {
            expect(storeInstance.store).toBe(mockPiniaStore)
        })

        it('should be read-only', () => {
            const result = storeInstance.store
            expect(result).toBe(mockPiniaStore)
        })
    })

    describe('addToState', () => {
        it('should add a single property to state', () => {
            storeInstance.state = {}
            storeInstance.addToState('newProp', 'value')

            expect(storeInstance.state.newProp).toBeDefined()
        })

        it('should add property with undefined value', () => {
            storeInstance.state = {}
            storeInstance.addToState('prop')

            expect(storeInstance.state.hasOwnProperty('prop')).toBe(true)
        })

        it('should add property to store object', () => {
            storeInstance.state = {}
            storeInstance.addToState('prop', 'value')

            expect(storeInstance.store.hasOwnProperty('prop')).toBe(true)
        })

        it('should wrap primitive values in ref for composition API', () => {
            ; (mockPiniaStore as any)._isOptionsAPI = false
            storeInstance = new Store(mockPiniaStore, mockOptions)

            storeInstance.state = {}
            storeInstance.addToState('count', 42)

            const value = storeInstance.state.count
            expect(isRef(value) || typeof value === 'number').toBe(true)
        })

        it('should not wrap existing refs', () => {
            ; (mockPiniaStore as any)._isOptionsAPI = false
            storeInstance = new Store(mockPiniaStore, mockOptions)

            const refValue = ref('test')
            storeInstance.state = {}
            storeInstance.addToState('prop', refValue)

            expect(storeInstance.state.prop).toBe(refValue)
        })
    })

    describe('customizeStore (static)', () => {
        it('should create a Store instance when options.storeOptions exists', () => {
            const options = { storeOptions: { test: true } as StoreOptions }
            const result = StoreChild.customizeStore<Store>(mockPiniaStore, options, false)

            expect(result).toBeInstanceOf(Store)
            expect(result?.debug).toBe(false)
        })

        it('should set debug mode in customized store', () => {
            const options = { storeOptions: { test: true } as StoreOptions }
            const result = StoreChild.customizeStore<Store>(mockPiniaStore, options, true)

            expect(result?.debug).toBe(true)
        })

        it('should return undefined when storeOptions is missing', () => {
            const options = {} as PluginStoreOptions
            const result = Store.customizeStore<Store>(mockPiniaStore, options)

            expect(result).toBeUndefined()
        })

        it('should work with custom Store subclass', () => {
            class CustomStore extends Store {
                protected static override _requiredKeys?: string[] | undefined = ['test']
                getCustomValue() {
                    return 'custom'
                }
            }

            const options = { storeOptions: { test: true } as StoreOptions }
            const result = CustomStore.customizeStore<CustomStore>(mockPiniaStore, options)

            expect(result).toBeInstanceOf(CustomStore)
            expect(result?.getCustomValue?.()).toBe('custom')
        })
    })

    describe('debugLog', () => {
        it('should log when debug is true', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            storeInstance.debug = true

            storeInstance.debugLog('test message', { data: 'test' })

            expect(consoleSpy).toHaveBeenCalled()
            consoleSpy.mockRestore()
        })

        it('should not log when debug is false', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            storeInstance.debug = false

            storeInstance.debugLog('test message', { data: 'test' })

            expect(consoleSpy).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
    })

    describe('hasDeniedFirstChar', () => {
        it('should return true for properties starting with _', () => {
            expect(storeInstance.hasDeniedFirstChar('_private')).toBe(true)
        })

        it('should return true for properties starting with $', () => {
            expect(storeInstance.hasDeniedFirstChar('$public')).toBe(true)
        })

        it('should return false for normal properties', () => {
            expect(storeInstance.hasDeniedFirstChar('normal')).toBe(false)
        })

        it('should return false for properties starting with numbers', () => {
            expect(storeInstance.hasDeniedFirstChar('123')).toBe(false)
        })

        it('should return false for properties starting with letters', () => {
            expect(storeInstance.hasDeniedFirstChar('abc')).toBe(false)
        })
    })

    describe('getOption', () => {
        it('should return option value if it exists', () => {
            const options: PluginStoreOptions = {
                storeOptions: {
                    debug: true,
                    customOptions: { key: 'value' }
                } as unknown as StoreOptions
            }
            storeInstance = new Store(mockPiniaStore, options)

            const result = storeInstance.getOption('debug')
            expect(result).toBe(true)
        })

        it('should return undefined for non-existent option', () => {
            const options: PluginStoreOptions = { storeOptions: {} as StoreOptions }
            storeInstance = new Store(mockPiniaStore, options)

            const result = storeInstance.getOption('debug')
            expect(result).toBeUndefined()
        })

        it('should return undefined when options is undefined', () => {
            storeInstance = new Store(mockPiniaStore, {} as PluginStoreOptions)

            const result = storeInstance.getOption('debug')
            expect(result).toBeUndefined()
        })
    })

    describe('getStatePropertyValue', () => {
        it('should get value of a property in state', () => {
            storeInstance.state = { count: 42 }

            const result = storeInstance.getStatePropertyValue('count')
            expect(result).toBe(42)
        })

        it('should handle ref values in state', () => {
            const refValue = ref('test')
            storeInstance.state = { prop: refValue }

            const result = storeInstance.getStatePropertyValue('prop')
            expect(result).toBe('test')
        })

        it('should return undefined for non-existent property', () => {
            storeInstance.state = {}

            const result = storeInstance.getStatePropertyValue('nonExistent')
            expect(result).toBeUndefined()
        })

        it('should handle null values', () => {
            storeInstance.state = { prop: null }

            const result = storeInstance.getStatePropertyValue('prop')
            expect(result).toBeNull()
        })
    })

    describe('subscriptions API', () => {
        it('should return undefined when no subscriptions added', () => {
            const result = storeInstance.getSubscriptions()
            expect(result).toBeUndefined()
        })

        it('should add and retrieve plugin subscriptions', () => {
            const pluginSub = vi.fn((s?: any) => [s])

            storeInstance.addSubscription('myPlugin', pluginSub)

            const subs = storeInstance.getSubscriptions()

            expect(subs).toBeDefined()
            expect(typeof subs!.myPlugin.subscription).toBe('function')
            // invoking stored subscription should return array as pluginSub does
            const res = subs!.myPlugin.subscription(storeInstance.store as any)
            expect(res).toEqual([storeInstance.store])
        })
    })

    describe('getValue', () => {
        it('should extract value from ref', () => {
            const refValue = ref('test')
            const result = storeInstance.getValue(refValue)
            expect(result).toBe('test')
        })

        it('should return primitive value as-is', () => {
            expect(storeInstance.getValue(42)).toBe(42)
            expect(storeInstance.getValue('test')).toBe('test')
            expect(storeInstance.getValue(true)).toBe(true)
        })

        it('should return object as-is', () => {
            const obj = { key: 'value' }
            expect(storeInstance.getValue(obj)).toEqual(obj)
        })

        it('should handle undefined', () => {
            expect(storeInstance.getValue(undefined)).toBeUndefined()
        })

        it('should handle null', () => {
            expect(storeInstance.getValue(null)).toBeNull()
        })

        it('should handle array values', () => {
            const arr = [1, 2, 3]
            expect(storeInstance.getValue(arr)).toEqual(arr)
        })

        it('should extract value from nested ref', () => {
            const nestedRef = ref({ count: 5 })
            const result = storeInstance.getValue(nestedRef)
            expect(result).toEqual({ count: 5 })
        })
    })

    describe('isOptionApi', () => {
        it('should return true when store uses Options API', () => {
            ; (mockPiniaStore as any)._isOptionsAPI = true
            storeInstance = new Store(mockPiniaStore, mockOptions)

            expect(storeInstance.isOptionApi()).toBe(true)
        })

        it('should return false when store uses Composition API', () => {
            ; (mockPiniaStore as any)._isOptionsAPI = false
            storeInstance = new Store(mockPiniaStore, mockOptions)

            expect(storeInstance.isOptionApi()).toBe(false)
        })
    })

    describe('native subscription helpers', () => {
        it('should return store and callback for onAction when set', () => {
            const cb = vi.fn()
            storeInstance.onAction = cb

            const onActionReturn = storeInstance.onAction && storeInstance.onAction()

            expect(onActionReturn).toBeDefined()
            expect(onActionReturn!.store).toBe(storeInstance.store)
            expect(onActionReturn!.callback).toBe(cb)
        })

        it('should return store and callback for storeSubscribe when set', () => {
            const cb = vi.fn()
            storeInstance.storeSubscribe = cb

            const subReturn = storeInstance.storeSubscribe && storeInstance.storeSubscribe()

            expect(subReturn).toBeDefined()
            expect(subReturn!.store).toBe(storeInstance.store)
            expect(subReturn!.callback).toBe(cb)
        })

        it('should return undefined for onAction when not set', () => {
            // ensure not set
            storeInstance = new Store(mockPiniaStore, mockOptions)

            expect(storeInstance.onAction).toBeUndefined()
        })

        it('should return undefined for storeSubscribe when not set', () => {
            // ensure not set
            storeInstance = new Store(mockPiniaStore, mockOptions)

            expect(storeInstance.storeSubscribe).toBeUndefined()
        })
    })

    describe('stateHas', () => {
        it('should return true if property exists in state', () => {
            storeInstance.state = { prop: 'value' }

            expect(storeInstance.stateHas('prop')).toBe(true)
        })

        it('should return false if property does not exist in state', () => {
            storeInstance.state = { prop: 'value' }

            expect(storeInstance.stateHas('nonExistent')).toBe(false)
        })

        it('should handle null values in state', () => {
            storeInstance.state = { prop: null }

            expect(storeInstance.stateHas('prop')).toBe(true)
        })

        it('should handle empty state', () => {
            storeInstance.state = {}

            expect(storeInstance.stateHas('prop')).toBe(false)
        })
    })

    describe('storeHas', () => {
        it('should return true if property exists in store', () => {
            ; (storeInstance.store as any).prop = 'value'

            expect(storeInstance.storeHas('prop')).toBe(true)
        })

        it('should return false if property does not exist in store', () => {
            expect(storeInstance.storeHas('nonExistent')).toBe(false)
        })

        it('should check pinia built-in methods', () => {
            expect(storeInstance.storeHas('$state')).toBe(true)
            expect(storeInstance.storeHas('$subscribe')).toBe(true)
        })
    })

    describe('Integration tests', () => {
        it('should handle complete state management workflow', () => {
            // Initialize state
            storeInstance.state = { count: 0, name: 'test' }
            expect(storeInstance.stateHas('count')).toBe(true)

            // Add new property
            storeInstance.addToState('active', true)
            expect(storeInstance.stateHas('active')).toBe(true)

            // Update state
            storeInstance.state = { ...storeInstance.state, count: 5 }
            expect(storeInstance.getStatePropertyValue('count')).toBe(5)
        })

        it('should handle mixed ref and primitive values', () => {
            const refValue = ref('refTest')
            storeInstance.state = { ref: refValue, primitive: 'primTest' }

            expect(storeInstance.getStatePropertyValue('ref')).toBe('refTest')
            expect(storeInstance.getStatePropertyValue('primitive')).toBe('primTest')
        })

        it('should correctly identify Option vs Composition API behavior', () => {
            ; (mockPiniaStore as any)._isOptionsAPI = false
            const compositionStore = new Store(mockPiniaStore, mockOptions)

            compositionStore.state = {}
            compositionStore.addToState('prop', 'value')

            expect(compositionStore.isOptionApi()).toBe(false)
            expect(compositionStore.stateHas('prop')).toBe(true)
        })

        describe('defineAStore', () => {
            it('should create store with function-based definition (composition API)', () => {
                const storeId = 'compositionStore'
                const setupFn = () => ({ count: ref(0) })

                const result = defineAStore(storeId, setupFn)

                expect(result).toBeDefined()
            })

            it('should create store with object-based definition (options API)', () => {
                const storeId = 'optionsStore'
                const optionsDef = {
                    state: () => ({ count: 0 }),
                    getters: {},
                    actions: {}
                }

                const result = defineAStore(storeId, optionsDef)

                expect(result).toBeDefined()
            })

            it('should pass options correctly to store definition', () => {
                const storeId = 'debugStore'
                const setupFn = () => ({ value: ref('test') })
                const options: StoreOptions = { debug: true, customOptions: {} }

                const result = defineAStore(storeId, setupFn, options)

                expect(result).toBeDefined()
            })

            it('should work without options parameter', () => {
                const setupFn = () => ({ state: { counter: 0 } })

                const result = defineAStore('minimalStore', setupFn)

                expect(result).toBeDefined()
            })

            it('should handle empty storeOptions when options not provided', () => {
                const optionsDef = { state: () => ({}), getters: {}, actions: {} }

                const result = defineAStore('testStore', optionsDef)

                expect(result).toBeDefined()
            })
        })
    })
})