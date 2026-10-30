import { createPluginSubscriber, traceGroups } from 'pinia-plugin-subscription/helpers'
//import { createPluginSubscriber } from '../../src/factories/plugin-subscriber'
//import { traceGroups } from '../../src/utils/traceGroups'
//import Tracer from '../../src/system/Tracer'

import type { PluginStoreOptions, StoreOnActionCallbackParameters } from 'pinia-plugin-subscription/types'
import type { Tracer } from 'pinia-plugin-subscription/helpers'


const pluginName = 'demo-plugin-object'

export function createDemoPluginObject() {
    const tracers = new WeakMap<object, Tracer>()

    return createPluginSubscriber(
        pluginName,
        (context, createTracer) => {
            const { options, store } = context
            if (typeof createTracer === 'function') {
                const tracer = createTracer(pluginName)
                tracers.set(store, tracer)
                tracer.debug('demoPluginObject:initialized', 'demo-plugin-object:initialize', undefined, store.$id)
            }

            return !!(options as PluginStoreOptions)?.storeOptions?.demo
        },
        {
            storeOnActionSubscription: ({ store }) => {
                const callback = ({ after, name }: StoreOnActionCallbackParameters) => {
                    const tracer = tracers.get(store)
                    tracer?.debug(
                        `demoPluginObject:onAction:${name}`,
                        `demo-plugin-object:on-action`,
                        undefined,
                        store.$id
                    )
                    after(() => {
                        tracer?.debug(
                            `demoPluginObject:onAction:${name}:after`,
                            `demo-plugin-object:on-action:after`,
                            () => ({ groupId: traceGroups.onActionAfter(store.$id) }),
                            store.$id
                        )
                    })
                }
                return { callback, store }
            }
        }
    )
}