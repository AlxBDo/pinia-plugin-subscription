import { Store, traceGroups } from 'pinia-plugin-subscription/helpers'

import type { StateTree, Store as PiniaStore, SubscriptionCallbackMutation } from 'pinia'
import type { StoreClassConstructorParams } from 'pinia-plugin-subscription/types'
import type {
    HydrationEnvironment,
    VisitorBrowserData,
    VisitorServerData,
    VisitorState
} from '../types/plugin'

// Traces come from the tracer PluginSubscription hands over to the subscriber (this.trace / this.traceError).
export default class VisitorEnvironmentStore extends Store {
    protected _className = 'VisitorEnvironmentStore'

    constructor(store: PiniaStore, options: StoreClassConstructorParams) {
        super(store, options)
        this.storeSubscribe = this.onMutationCallback.bind(this)
    }

    protected static hasRequiredKeys(options: { demoEnvironmentHydration?: unknown }): boolean {
        return options.demoEnvironmentHydration === true
    }

    async hydrateFromServer(loadData: () => Promise<VisitorServerData>): Promise<void> {
        const scope = this.store.$id

        this.trace('server:hydrate:start', scope)
        try {
            const data = await loadData()

            this.patchVisitor('server', 'Subscriber loaded the request data, before rendering', (state) => {
                state.server = data
            })
            this.trace('server:hydrate:done', scope, () => ({ ...data }))
        } catch (error) {
            this.traceError('server:hydrate', error, scope)
            throw error
        }
    }

    hydrateFromBrowser(readBrowserData: () => VisitorBrowserData): void {
        const scope = this.store.$id

        this.trace('browser:hydrate:start', scope)
        try {
            const data = readBrowserData()

            this.patchVisitor('client', 'Subscriber read the browser APIs, after hydration', (state) => {
                state.browser = data
            })
            this.trace('browser:hydrate:done', scope, () => ({ ...data }))
        } catch (error) {
            this.traceError('browser:hydrate', error, scope)
            throw error
        }
    }

    private onMutationCallback(_mutation: SubscriptionCallbackMutation<StateTree>) {
        this.trace('onMutation', this.store.$id, () => ({
            groupId: traceGroups.onMutation(this.store.$id)
        }))
    }

    private patchVisitor(
        environment: HydrationEnvironment,
        label: string,
        update: (state: VisitorState) => void
    ) {
        this.store.$patch((state: StateTree) => {
            const visitor = state as VisitorState

            update(visitor)
            visitor.steps.push({ at: new Date().toISOString(), environment, label })
        })
    }
}
