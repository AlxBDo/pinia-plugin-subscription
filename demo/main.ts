import './style.css'
import { createDemoApp } from './app'
import { createBrowserVisitorSubscriber } from './plugins/demoPluginEnvironmentHydration'
import type { StateTree } from 'pinia'

const stateElement = document.querySelector<HTMLScriptElement>('#pinia-state')
const initialState = JSON.parse(stateElement?.textContent ?? 'null') as StateTree | null

const { app } = createDemoApp('client', initialState ?? undefined, [createBrowserVisitorSubscriber()])
app.mount('#app')
