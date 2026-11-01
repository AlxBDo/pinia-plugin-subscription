import PluginSubscription from "../core/PluginSubscription"
import { createTracerRegistry } from "../factories/trace-registry"
import { isProductionEnvironment } from "../utils/environment"

import type { PiniaPlugin } from "pinia"
import type { PluginSubscriber, PluginSubscriptionOptions } from "../types/plugin"
import type { TraceRegistry } from "../types/trace"
import type { RollbackActionParams, StoreOptions } from "../types/store"

/**
 * Creates a Pinia plugin that manages the specified plugin subscribers.
 *
 * @param subscribers The list of plugin subscribers to be used by the plugin.
 * @param options The options for configuring the plugin subscription.
 * @returns A Pinia plugin that handles the provided subscribers and options.
 */
export function createPlugin(
    subscribers: PluginSubscriber[],
    options?: PluginSubscriptionOptions
): PiniaPlugin {
    let pluginOptions = options

    if (options?.devtools && typeof window !== 'undefined' && !isProductionEnvironment()) {
        const journal = options.tracerHandler?.journal
        if (options.tracerHandler && !journal) {
            throw new Error('The devtools option requires a registry tracerHandler with a journal.')
        }

        let registry: Pick<TraceRegistry, 'journal'>
        if (options.tracerHandler) {
            registry = { journal }
            pluginOptions = options
        } else {
            const createdRegistry = createTracerRegistry({ journal: true, redact: true })
            registry = createdRegistry
            pluginOptions = { ...options, tracerHandler: createdRegistry.tracerHandler }
        }
        const devtoolsOptions = options.devtools === true ? undefined : options.devtools
        const serverSnapshotId = devtoolsOptions?.serverSnapshotId ?? 'pinia-traces'

        if (serverSnapshotId !== false && registry.journal) {
            const snapshotElement = document.getElementById(serverSnapshotId)
            if (snapshotElement instanceof HTMLScriptElement && snapshotElement.type === 'application/json') {
                try {
                    registry.journal.import(JSON.parse(snapshotElement.textContent ?? 'null'))
                } catch (error) {
                    console.error(`Failed to import SSR trace snapshot (element id: ${serverSnapshotId}).`, error)
                }
            }
        }

        void import('../devtools')
            .then(({ mountTraceDevtools }) => mountTraceDevtools(registry, devtoolsOptions))
            .catch(error => {
                console.error('Failed to load pinia-plugin-subscription devtools.', error)
            })
    }

    const pluginSubscription = new PluginSubscription(subscribers, pluginOptions)

    return pluginSubscription.plugin.bind(pluginSubscription)
}

declare module 'pinia' {
    export interface PiniaCustomProperties {
        /**
         * Executes an action and restores the previous state snapshot if it fails.
         * Added to every store when the plugin is active.
         *
         * @param params The action name and the state keys to snapshot.
         * @param args The action arguments, passed as a single array (forwarded via `apply`).
         */
        $rollbackAfterFailure: (params: RollbackActionParams, args?: any[]) => Promise<void>
    }

    export interface DefineStoreOptionsBase<S, Store> {
        storeOptions?: StoreOptions
    }
}