import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from './plugins/createPlugin'
import { extendingStoreSubscriber } from './extending-pinia-store/plugins/ExtendingStoreSubscriber'
import { pluginName } from './utils/constantes'

const app = createApp(App)
const pinia = createPinia()

pinia.use(
    createPlugin(
        [extendingStoreSubscriber],
        [pluginName, 'pinia-plugin-extending-store', 'PluginSubscription']
    ))

app.use(pinia)
app.mount('#app')
