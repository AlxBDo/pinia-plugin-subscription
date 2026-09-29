import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { addTraceListener } from '../system/Tracer.ts'
import { createPlugin } from '../plugins/createPlugin.ts'
import { createConsoleTraceListener } from '../system/createConsoleTraceListener.ts'
import { ExtendsPiniaStore, PLUGIN_NAME as PPES } from 'pinia-plugin-extending-store'
import { pluginName } from '../utils/constantes.ts'

const app = createApp(App)
const pinia = createPinia()

pinia.use(
    createPlugin(
        [ExtendsPiniaStore]
    )
)

addTraceListener({
    ...createConsoleTraceListener(),
    filter: event => event.scope === 'rollbackSnapshotStoreWithRollback'
})

app.use(pinia)
app.mount('#app')
