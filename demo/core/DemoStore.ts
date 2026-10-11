import Store from '../../src/core/Store'

import type { StateTree, Store as PiniaStore, SubscriptionCallbackMutation } from "pinia"
import type { PluginStoreOptions, PluginSubscriptionOptions, StoreOnActionCallbackParameters } from 'pinia-plugin-subscription'
import type { DemoPluginOptions } from '../types/plugin'

export default class DemoStore extends Store {
    protected static _requiredKeys?: string[] = ['active']

    constructor(store: PiniaStore, options: { storeOptions: DemoPluginOptions }) {
        super(store, options)
        this.initialize()
    }

    private augmentState() {
        // Augment the store state here if needed
        this.state.pluginIsActive = true
    }

    private augmentStore() {
        // Augment the store here if needed
        this.store.pluginIsActiveToggle = () => {
            this.state.pluginIsActive = !this.state.pluginIsActive
            this.trace(`DemoStore:pluginIsActiveToggle`, {
                scope: this.store.$id,
                pluginIsActive: this.state.pluginIsActive
            })
        }
    }

    protected static hasRequiredKeys(options: DemoPluginOptions & PluginStoreOptions & PluginSubscriptionOptions): boolean {
        // Plugin is executed only if the hasRequiredKeys check passes
        return options.active === true
    }

    private initialize() {
        // Using the trace method to log DemoStore methods execution
        // Store state, store and options are available using this.state, this.store and this.options
        this.trace('DemoStore:initialize', {
            state: this.state,
            storeOptions: this.options
        }, this.store.$id)

        this.augmentState()
        this.augmentStore()

        // Use this.onAction to handle store actions
        // Bind the onAction callback to the current instance
        this.onAction = this.onActionCallback.bind(this)

        // Use this.storeSubscribe to handle store mutations
        // Bind the onMutation callback to the current instance
        this.storeSubscribe = this.onMutationCallback.bind(this)
    }

    private onActionCallback({ after, args, name, onError }: StoreOnActionCallbackParameters) {
        // Handle the mutation here
        this.trace(`DemoStore:onAction:before:${name}`, { actionArgs: args }, this.store.$id)

        after((result) => {
            this.trace(`DemoStore:onAction:after:${name}`, {
                actionResult: result,
                actionArgs: args
            }, this.store.$id)
        })

        onError((error) => {
            this.trace(`DemoStore:onAction:error:${name}`, {
                actionError: error,
                actionArgs: args
            }, this.store.$id)
        })
    }

    private onMutationCallback(mutation: SubscriptionCallbackMutation<StateTree>) {
        // Handle the mutation here
        this.trace(`demo-store:on-mutation`, { mutation }, this.store.$id)
    }
}