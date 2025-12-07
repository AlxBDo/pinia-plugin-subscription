import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createPlugin } from './plugins/createPlugin'
import ExtendsPiniaStore from './extending-pinia-store/plugins/ExtendsPiniaStore'

const app = createApp(App)
const pinia = createPinia()
pinia.use(createPlugin([ExtendsPiniaStore]))

app.use(pinia)
app.mount('#app')
