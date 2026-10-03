import PluginSubscription from '../core/PluginSubscription'

import type { PiniaPlugin } from 'pinia'
import type { PluginSubscriber, PluginSubscriptionOptions } from '../types/plugin'

/**
 * Creates a Pinia plugin that manages hydration for the specified plugin subscribers.
 * @param subscribers The list of plugin subscribers to be used by the hydration plugin.
 * @param options The options for configuring the plugin subscription.
 * @returns A Pinia plugin that handles hydration based on the provided subscribers and options.
 * @deprecated use `createPlugin` with appropriate hydration options instead.
 */
export function createHydrationPlugin(
    subscribers: PluginSubscriber[],
    options?: PluginSubscriptionOptions
): PiniaPlugin {
    const hydrationPlugin = new PluginSubscription(subscribers, {
        execution: options?.execution,
        hydrationScheduler: options?.hydrationScheduler,
        runtimeEnvironment: options?.runtimeEnvironment,
        subscriberExecution: options?.subscriberExecution,
    })

    return hydrationPlugin.plugin.bind(hydrationPlugin)
}
