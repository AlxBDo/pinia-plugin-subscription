import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from '../src/plugins/createPlugin.ts'
//import { createPlugin } from 'pinia-plugin-subscription'
//import { createTracerRegistry } from 'pinia-plugin-subscription/helpers'
import { createTracerRegistry } from '../src/factories/trace-registry.ts'
import { DemoPluginClass } from './plugins/DemoPluginClass.ts'
import { demoPluginObject } from './plugins/demoPluginObject.ts'
import { ExtendsPiniaStore } from 'pinia-plugin-extending-store'


const app = createApp(App)
const pinia = createPinia()

const tracerRegistry = createTracerRegistry()

pinia.use(
    createPlugin(
        [DemoPluginClass, ExtendsPiniaStore, demoPluginObject],
        { tracerHandler: tracerRegistry.tracerHandler }
    )
)

tracerRegistry.addScopesListener(['rollbackSnapshotStoreWithRollback', 'lists'])

app.use(pinia)
app.mount('#app')
