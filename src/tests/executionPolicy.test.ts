import { describe, expect, it, vi } from 'vitest'
import ExecutionPolicy from '../core/ExecutionPolicy'

import type { PluginSubscriber } from '../types/plugin'

const subscriber = (props: Partial<PluginSubscriber> = {}) => ({ name: 'sub', ...props }) as PluginSubscriber

describe('ExecutionPolicy', () => {
    it('merges execution options: defaults < global < subscriber < per-subscriber override', () => {
        const policy = new ExecutionPolicy({
            execution: { environment: 'client', order: 1 },
            subscriberExecution: { sub: { order: 3 } }
        })

        expect(policy.resolveExecution(subscriber({ execution: { hydration: 'defer', order: 2 } })))
            .toEqual({ environment: 'client', hydration: 'defer', order: 3 })
    })

    it('filters by runtime environment', () => {
        const policy = new ExecutionPolicy({ runtimeEnvironment: 'server' })

        expect(policy.shouldInvoke({ environment: 'both', hydration: 'immediate', order: 9 })).toBe(true)
        expect(policy.shouldInvoke({ environment: 'server', hydration: 'immediate', order: 9 })).toBe(true)
        expect(policy.shouldInvoke({ environment: 'client', hydration: 'immediate', order: 9 })).toBe(false)
    })

    it('defers hydration only on the client', () => {
        const deferred = { environment: 'both', hydration: 'defer', order: 9 } as const

        expect(new ExecutionPolicy({ runtimeEnvironment: 'client' }).shouldScheduleAfterHydration(deferred)).toBe(true)
        expect(new ExecutionPolicy({ runtimeEnvironment: 'server' }).shouldScheduleAfterHydration(deferred)).toBe(false)
    })

    it('prefers the subscriber scheduler over the global one', () => {
        const global = vi.fn()
        const own = vi.fn()
        const policy = new ExecutionPolicy({ hydrationScheduler: global })

        expect(policy.resolveHydrationScheduler(subscriber())).toBe(global)
        expect(policy.resolveHydrationScheduler(subscriber({ hydrationScheduler: own }))).toBe(own)
    })
})
