import { createSSRApp } from 'vue'
import { createPinia, type StateTree } from 'pinia'
import { createPlugin } from 'pinia-plugin-subscription'
import { createTracerRegistry } from 'pinia-plugin-subscription/helpers'
import type { PluginRuntimeEnvironment, PluginSubscriberInterface } from 'pinia-plugin-subscription/types'
import { ExtendsPiniaStore } from 'pinia-plugin-extending-store'

import App from './App.vue'
import { createDemoPluginClass } from './plugins/DemoPluginClass'
import { createDemoPluginObject } from './plugins/demoPluginObject'

export function createDemoApp(
    runtimeEnvironment: PluginRuntimeEnvironment,
    initialState?: StateTree,
    extraSubscribers: PluginSubscriberInterface[] = []
) {
    const app = createSSRApp(App)
    const pinia = createPinia()

    if (initialState) {
        pinia.state.value = initialState
    }

    const tracerRegistry = createTracerRegistry({ journal: true })
    const subscribers: PluginSubscriberInterface[] = [
        createDemoPluginClass(),
        createDemoPluginObject(),
        ExtendsPiniaStore,
        ...extraSubscribers
    ]

    pinia.use(createPlugin(subscribers, {
        runtimeEnvironment,
        tracerHandler: tracerRegistry.tracerHandler
    }))

    // Per-request registry: server traces go to the Node terminal, browser traces to the devtools console.
    tracerRegistry.addScopesListener(['visitorEnvironmentStore'])

    if (runtimeEnvironment === 'client') {
        tracerRegistry.addScopesListener([
            'rollbackSnapshotStoreWithRollback',
            'enhancedStore'
        ])
    }

    app.use(pinia)
    return { app, pinia, tracerRegistry }
}
