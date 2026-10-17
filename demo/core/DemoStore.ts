import Store from '../../src/core/Store'

import type { StateTree, Store as PiniaStore, SubscriptionCallbackMutation } from "pinia"
import type { PluginStoreOptions, PluginSubscriptionOptions, StoreOnActionCallbackParameters } from 'pinia-plugin-subscription'
import type { DemoPluginClassOptions } from '../types/plugin'

export default class DemoStore extends Store {
    protected _className = 'DemoStore'
    protected static _requiredKeys?: string[] = ['active']

    constructor(store: PiniaStore, options: { storeOptions: DemoPluginClassOptions }) {
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
            this.trace(`pluginIsActiveToggle`, this.store.$id, {
                pluginIsActive: this.state.pluginIsActive
            })
        }
    }

    protected static hasRequiredKeys(options: DemoPluginClassOptions & PluginStoreOptions & PluginSubscriptionOptions): boolean {
        // Plugin is executed only if the hasRequiredKeys check passes
        return options.active === true
    }

    private initialize() {
        // Using the trace method to log DemoStore methods execution
        // Store state, store and options are available using this.state, this.store and this.options
        this.trace('initialize', this.store.$id)

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
        this.trace(`onAction:before:${name}`, this.store.$id)

        after((result) => {
            this.trace(`onAction:after:${name}`, this.store.$id, () => ({
                actionResult: result
            }))
        })

        onError((error) => {
            this.trace(`onAction:error:${name}`, this.store.$id, () => ({
                actionError: error
            }))
        })
    }

    private onMutationCallback(mutation: SubscriptionCallbackMutation<StateTree>) {
        // Handle the mutation here
        this.trace(`onMutation`, this.store.$id)
    }
}