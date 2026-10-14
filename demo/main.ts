import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from '../src/plugins/createPlugin.ts'
import { createTracerRegistry, createTraceGroupsRegistry } from '../src/factories/trace-registry.ts'
import { DemoPlugin } from './plugins/DemoPlugin.ts'
import { ExtendsPiniaStore, PLUGIN_NAME as PPES } from 'pinia-plugin-extending-store'
import { pluginName } from '../src/utils/constantes.ts'

const app = createApp(App)
const pinia = createPinia()

//const tracerRegistry = createTracerRegistry()
const tracerGroupRegistry = createTraceGroupsRegistry()

pinia.use(
    createPlugin(
        [DemoPlugin, ExtendsPiniaStore],
        { tracerHandler: tracerGroupRegistry.tracerHandler }
    )
)

tracerGroupRegistry.addListener([{
    target: 'scope',
    value: 'rollbackSnapshotStoreWithRollback'
}, { target: 'scope', value: 'lists' }], { filterMode: 'some' })

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
