import { ref } from 'vue'
import { defineAStoreCtx, getEnhancedStore } from 'pinia-plugin-subscription'

interface EnhancedStore {
    pluginIsActive: boolean
    pluginIsActiveToggle: () => void
}

/**
 * `defineAStoreCtx` exposes the plugin-enhanced store (here augmented by `DemoStore`)
 * to the setup function. The enhanced store is attached once the plugins have run,
 * so it must be read lazily — inside actions — and not while the setup function executes.
 */
export const useEnhancedStore = defineAStoreCtx('enhancedStore', (ctx) => {
    const label = ref('plugin enabled')

    function toggle() {
        const enhanced = getEnhancedStore<EnhancedStore>(ctx)
        enhanced.pluginIsActiveToggle()
        label.value = enhanced.pluginIsActive ? 'plugin enabled' : 'plugin disabled'
    }

    return { label, toggle }
}, { active: true, demo: true })
