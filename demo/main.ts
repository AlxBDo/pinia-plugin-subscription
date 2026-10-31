import './style.css'
import { createDemoApp } from './app'
import { createBrowserVisitorSubscriber } from './plugins/demoPluginEnvironmentHydration'
import type { StateTree } from 'pinia'

const stateElement = document.querySelector<HTMLScriptElement>('#pinia-state')
const initialState = JSON.parse(stateElement?.textContent ?? 'null') as StateTree | null

const { app, tracerRegistry } = createDemoApp('client', initialState ?? undefined, [createBrowserVisitorSubscriber()])
app.mount('#app')

// Development only: traces of the server render (embedded in the page) and of the browser, in one aside.
if (import.meta.env.DEV) {
    const tracesElement = document.querySelector<HTMLScriptElement>('#pinia-traces')
    tracerRegistry.journal?.import(JSON.parse(tracesElement?.textContent ?? 'null'))
    import('pinia-plugin-subscription/devtools').then(({ mountTraceDevtools }) => mountTraceDevtools(tracerRegistry))
}
