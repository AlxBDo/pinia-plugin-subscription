import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from '../plugins/createPlugin.ts'
import { createTracerRegistry } from '../factories/trace-registry.ts'
import { createConsoleTraceListener } from '../system/createConsoleTraceListener.ts'
import { ExtendsPiniaStore, PLUGIN_NAME as PPES } from 'pinia-plugin-extending-store'
import { pluginName } from '../utils/constantes.ts'

const app = createApp(App)
const pinia = createPinia()

const tracerRegistry = createTracerRegistry()

pinia.use(
    createPlugin(
        [ExtendsPiniaStore],
        //{ createTracer: tracerRegistry.createTracer }
    )
)

tracerRegistry.addTraceListener({
    ...createConsoleTraceListener(),
    filter: event => {
        return event.scope === 'rollbackSnapshotStoreWithRollback'
    }
})

app.use(pinia)
app.mount('#app')
