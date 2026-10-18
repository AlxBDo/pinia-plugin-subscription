import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from '../src/plugins/createPlugin.ts'
//import { createPlugin } from 'pinia-plugin-subscription'
//import { createTracerRegistry } from 'pinia-plugin-subscription/helpers'
import { createTracerRegistry } from '../src/factories/trace-registry.ts'
import { DemoPluginClass } from './plugins/DemoPluginClass.ts'
import { demoPluginObject } from './plugins/DemoPluginObject.ts'
import { ExtendsPiniaStore, PLUGIN_NAME as PPES } from 'pinia-plugin-extending-store'

const app = createApp(App)
const pinia = createPinia()

const tracerRegistry = createTracerRegistry()

pinia.use(
    createPlugin(
        [DemoPluginClass, ExtendsPiniaStore, demoPluginObject],
        { tracerHandler: tracerRegistry.tracerHandler }
    )
)


/**
 tracerRegistry.addListener({
    filter: event => {
        const namespaceArray = event.namespace?.split(':') ?? []
        return event.scope === 'rollbackSnapshotStoreWithRollback' && (
            namespaceArray[0] === 'demostore'
            || namespaceArray[0] === 'pluginsubscription'
            || namespaceArray[0] === 'store'
            || !namespaceArray[0]
        )
    }
})
 */


tracerRegistry.addListener(
    [
        {
            target: 'scope',
            value: 'rollbackSnapshotStoreWithRollback',
        },
        //{ target: 'namespace', value: 'demostore', comparator: 'startsWith' },
        { target: 'scope', value: 'lists' }
    ],
    { filterMode: 'some' }
)

/**

tracerRegistry.addTraceListener({
    filter: [{
        target: 'scope',
        value: 'rollbackSnapshotStoreWithRollback'
    }]
})

tracerRegistry.addTraceListener({
    ...createConsoleTraceListener(),
    filter: event => {
        return event.scope === 'rollbackSnapshotStoreWithRollback'
    }
})
*/

app.use(pinia)
app.mount('#app')
