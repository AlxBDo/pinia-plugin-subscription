import { renderToString } from 'vue/server-renderer'
import { useVisitorEnvironmentStore } from './stores/visitor-environment'
import { createDemoApp } from './app'
import { createBrowserVisitorSubscriber, createServerVisitorSubscriber } from './plugins/demoPluginEnvironmentHydration'
import { parsePreferredLocale } from './utils/parsePreferredLocale'

import type { DemoRequestContext } from './types/plugin'

export async function renderDemo(pathname: string, request: DemoRequestContext = {}) {
    const serverVisitor = createServerVisitorSubscriber(async () => ({
        locale: parsePreferredLocale(request.acceptLanguage),
        pathname,
        renderedAt: new Date().toISOString()
    }))
    // Registered on the server too: the plugin skips it there because it is client-only.
    const { app, pinia } = createDemoApp('server', undefined, [
        serverVisitor.subscriber,
        createBrowserVisitorSubscriber()
    ])

    useVisitorEnvironmentStore(pinia)
    await serverVisitor.ready

    return {
        html: await renderToString(app),
        state: pinia.state.value
    }
}
