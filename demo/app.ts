import { createSSRApp } from 'vue'
import { createPinia, type StateTree } from 'pinia'
import { createPlugin } from 'pinia-plugin-subscription'
import { createTraceDevtools } from 'pinia-plugin-subscription-devtools'
import { StateSnapshotsSubscriber } from 'pinia-plugin-state-snapshots'
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

    // Mounts the in-page panel in the browser; on the server only records the journal sent to the client
    const { registry: tracerRegistry } = createTraceDevtools()
    // Override store reset
    StateSnapshotsSubscriber.overrideReset = true
    const subscribers: PluginSubscriberInterface[] = [
        createDemoPluginClass(),
        createDemoPluginObject(),
        ExtendsPiniaStore,
        StateSnapshotsSubscriber,
        ...extraSubscribers
    ]

    pinia.use(createPlugin(subscribers, {
        runtimeEnvironment,
        tracerHandler: tracerRegistry.tracerHandler
    }))

    app.use(pinia)
    return {
        app, pinia,
        tracerRegistry
    }
}
