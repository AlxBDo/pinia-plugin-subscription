import { createPinia, defineStore } from 'pinia'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import Store from '../core/Store'
import type { PluginStoreOptions } from '../types'

describe('Store.addToState with Pinia', () => {
    it('exposes added setup-store state as a reactive Pinia store property', () => {
        const useSetupStore = defineStore('addedPluginState', () => ({
            count: ref(0)
        }))
        const piniaStore = useSetupStore(createPinia())
        const pluginStore = new Store(piniaStore, { storeOptions: {} } as PluginStoreOptions)
        const storeWithPluginState = piniaStore as typeof piniaStore & { pluginIsActive: boolean }

        pluginStore.addToState('pluginIsActive', true)

        expect(storeWithPluginState.pluginIsActive).toBe(true)
        expect(pluginStore.state.pluginIsActive).toBe(true)

        storeWithPluginState.pluginIsActive = false

        expect(pluginStore.state.pluginIsActive).toBe(false)

        pluginStore.state.pluginIsActive = true

        expect(storeWithPluginState.pluginIsActive).toBe(true)
    })
})
