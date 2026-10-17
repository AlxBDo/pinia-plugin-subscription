import type { PluginSubscriber, PluginSubscriberInvoke } from "../types/plugin";


/**
 * Creates a new plugin subscriber with the given name, invoke function, and optional properties.
 * @param name - plugin name.
 * @param invoke - function to invoke for the plugin subscriber.
 * @param optionalProps - optional additional properties for the plugin subscriber.
 * @param {Function} optionalProps.afterHydration
 * @param {PluginExecutionOptions} optionalProps.execution
 * @param {Function} optionalProps.hydrate
 * @param {PluginHydrationScheduler} optionalProps.hydrationScheduler
 * @param {Function} optionalProps.resetStoreCallback
 * @param {StoreOnActionSubscription} optionalProps.storeOnActionSubscription
 * @param {StoreMutationSubscription} optionalProps.storeMutationSubscription
 * @param {PluginSubscriptions} optionalProps.subscriptions
 * @param 
 * @returns A new plugin subscriber object.
 */
export function createPluginSubscriber(
    name: string,
    invoke: PluginSubscriberInvoke,
    optionalProps?: Omit<PluginSubscriber, "name" | "invoke">
): PluginSubscriber {
    return {
        name,
        invoke,
        ...optionalProps,
    };
}