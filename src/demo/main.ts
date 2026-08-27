import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createPlugin } from '../lib/main'
import { pluginName } from '../utils/constantes'

const app = createApp(App)
const pinia = createPinia()

pinia.use(createPlugin([], [pluginName]))

app.use(pinia)
app.mount('#app')
