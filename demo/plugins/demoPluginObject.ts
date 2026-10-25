//import { createPluginSubscriber, Tracer } from 'pinia-plugin-subscription/helpers'
import { createPluginSubscriber } from '../../src/factories/plugin-subscriber'
import Tracer from '../../src/system/Tracer'

import type { Store } from 'pinia'
import type { PluginStoreOptions, StoreOnActionCallbackParameters } from 'pinia-plugin-subscription/types'


const pluginName = 'demo-plugin-object'
let tracer: Tracer
let store: Store

export const demoPluginObject = createPluginSubscriber(
    pluginName,
    (context, createTracer) => {
        store = context.store
        const { options } = context
        if (typeof createTracer === 'function') {
            tracer = createTracer(pluginName)
            tracer.debug('demoPluginObject:initialized', 'demo-plugin-object:initialize', undefined, store.$id)
        }

        return !!(options as PluginStoreOptions)?.storeOptions?.demo
    },
    {
        storeOnActionSubscription: () => {
            const callback = ({ after, name }: StoreOnActionCallbackParameters) => {
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
                        () => ({ groupId: `store:onAction:after:${store.$id}` }),
                        store.$id
                    )
                })
            }
            return { callback, store }
        }
    }
)