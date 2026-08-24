import PluginSubscription from './pluginSubscription'

import type { PiniaPlugin } from 'pinia'
import type { PluginSubscriber, PluginSubscriptionOptions } from '../types/plugin'

export function createHydrationPlugin(
    subscribers: PluginSubscriber[],
    options?: PluginSubscriptionOptions
): PiniaPlugin {
    const hydrationPlugin = new PluginSubscription(subscribers, options?.debug, {
        execution: options?.execution,
        hydrationScheduler: options?.hydrationScheduler,
        runtimeEnvironment: options?.runtimeEnvironment,
        subscriberExecution: options?.subscriberExecution,
    })

    return hydrationPlugin.plugin.bind(hydrationPlugin)
}
