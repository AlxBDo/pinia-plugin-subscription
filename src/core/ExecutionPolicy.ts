import type {
    PluginExecutionOptions,
    PluginHydrationScheduler,
    PluginRuntimeEnvironment,
    PluginSubscriber,
    PluginSubscriptionOptions
} from "../types/plugin"

export const defaultPluginExecution: Required<PluginExecutionOptions> = {
    environment: 'both',
    hydration: 'immediate',
    order: 9
}

export function defaultHydrationScheduler(callback: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => globalThis.setTimeout(callback, 0))
        return
    }

    globalThis.setTimeout(callback, 0)
}

/** Stateless rules deciding whether, when and how a subscriber runs. */
export default class ExecutionPolicy {
    private _hydrationScheduler: PluginHydrationScheduler
    private _options?: PluginSubscriptionOptions

    constructor(_options?: PluginSubscriptionOptions) {
        this._options = _options
        this._hydrationScheduler = _options?.hydrationScheduler ?? defaultHydrationScheduler
    }

    get currentEnvironment(): PluginRuntimeEnvironment {
        return this._options?.runtimeEnvironment
            ?? (typeof window === 'undefined' ? 'server' : 'client')
    }

    get hydrationScheduler(): PluginHydrationScheduler {
        return this._hydrationScheduler
    }

    resolveExecution(subscriber: PluginSubscriber): Required<PluginExecutionOptions> {
        return {
            ...defaultPluginExecution,
            ...(this._options?.execution ?? {}),
            ...(subscriber.execution ?? {}),
            ...(this._options?.subscriberExecution?.[subscriber.name] ?? {}),
        }
    }

    resolveHydrationScheduler(subscriber: Pick<PluginSubscriber, 'hydrationScheduler'>): PluginHydrationScheduler {
        return subscriber.hydrationScheduler ?? this._hydrationScheduler
    }

    shouldInvoke(execution: Required<PluginExecutionOptions>): boolean {
        return execution.environment === 'both' || execution.environment === this.currentEnvironment
    }

    shouldScheduleAfterHydration(execution: Required<PluginExecutionOptions>): boolean {
        return this.currentEnvironment === 'client' && execution.hydration === 'defer'
    }
}
