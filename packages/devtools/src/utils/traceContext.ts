import type { TraceEvent } from '../types/trace'

/** Context events describe a store (state, subscribers, options) and are emitted when a store is set up. */
export function isContextEvent(event: Pick<TraceEvent, 'namespace'>): boolean {
    return event.namespace.endsWith(':context')
}

interface NamedSubscriber {
    execution?: unknown
    name?: unknown
    pluginOptions?: unknown
}

/** Subscribers by name, like the console does, keeping their execution options and plugin options. */
export function describeSubscribers(subscribers: unknown[]): Record<string, unknown> {
    const described: Record<string, unknown> = {}

    subscribers.forEach(item => {
        const { execution, name, pluginOptions } = (item ?? {}) as NamedSubscriber
        const baseName = typeof name === 'string' && name ? name : 'anonymous'
        let key = baseName
        for (let duplicate = 2; key in described; duplicate++) { key = `${baseName} (${duplicate})` }

        described[key] = {
            ...(execution !== undefined && { execution }),
            ...(pluginOptions !== undefined && { pluginOptions })
        }
    })

    return described
}

/** Context payload as displayed by the devtools: named subscribers, and options without their actions. */
export function buildContextView(payload: Record<string, unknown>): Record<string, unknown> {
    const view = { ...payload }

    if (Array.isArray(view.subscribers)) {
        view.subscribers = describeSubscribers(view.subscribers)
    }

    if (view.options && typeof view.options === 'object') {
        const options = view.options as { storeOptions?: unknown }
        const shown = options.storeOptions && typeof options.storeOptions === 'object' ? options.storeOptions : options
        const { actions: _actions, ...withoutActions } = shown as Record<string, unknown>
        view.options = withoutActions
    }

    return view
}
