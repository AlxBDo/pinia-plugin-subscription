import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from '../plugins/createPlugin.ts'
import { ExtendsPiniaStore, PLUGIN_NAME as PPES } from 'pinia-plugin-extending-store'
import { pluginName } from '../utils/constantes.ts'

const app = createApp(App)
const pinia = createPinia()

pinia.use(
    createPlugin(
        [ExtendsPiniaStore],
        //[pluginName, PPES, 'PluginSubscription']
    ))

app.use(pinia)
app.mount('#app')
