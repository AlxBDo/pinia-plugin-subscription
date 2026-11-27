import { createPinia, defineStore } from 'pinia'
import { PluginSubscription } from 'pinia-plugin-subscription/helpers'
import { createApp } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StateSnapshots from '../core/StateSnapshots'
import { StateSnapshotsSubscriberClass } from '../plugin/state-snapshots-subscriber'

import type { PiniaPluginContext } from 'pinia'

function createContext(storeOptions?: PiniaPluginContext['options']['storeOptions']): PiniaPluginContext {
    const pinia = createPinia()
    const store = defineStore('snapshots', {
        state: () => ({ count: 0, text: 'initial', nested: { value: 1 } }),
        actions: {
            update(value: number, fail = false) {
                this.count = value
                this.text = 'changed'
                if (fail) throw new Error('action failed')
                return value
            },
            async updateLater(value: number, gate: Promise<void>) {
                this.count = value
                await gate
                throw new Error(`failed ${value}`)
            }
        }
    })(pinia)
    return { app: createApp({}), pinia, store, options: { actions: {}, ...(storeOptions && { storeOptions }) } }
}

function install(context: PiniaPluginContext, subscriber = new StateSnapshotsSubscriberClass()) {
    new PluginSubscription([subscriber]).plugin(context)
    return subscriber
}

afterEach(() => vi.restoreAllMocks())

describe('StateSnapshotsSubscriberClass', () => {
    it('does not install a wrapper when no snapshot option is enabled', () => {
        const context = createContext()
        const reset = context.store.$reset
        const subscriber = install(context)

        expect(subscriber.getStoreInstance(context.store)).toBeUndefined()
        expect(context.store.$reset).toBe(reset)
        expect(context.store.$rollbackAfterFailure).toBeUndefined()
        expect(context.store.$onResetStore).toBeUndefined()
    })

    it('applies global reset and manual rollback flags without mutating store options', async () => {
        const context = createContext()
        const subscriber = new StateSnapshotsSubscriberClass()
        subscriber.overrideReset = true
        subscriber.rollbackAfterFailure = true
        install(context, subscriber)

        expect(context.options.storeOptions).toBeUndefined()
        expect(subscriber.getStoreInstance(context.store)).toBeInstanceOf(StateSnapshots)
        await expect(context.store.$rollbackAfterFailure({ action: 'update' }, [4, true])).rejects.toThrow('action failed')
        expect(context.store.count).toBe(0)
        context.store.count = 8
        context.store.$reset()
        expect(context.store.count).toBe(0)
    })

    it('preserves per-action rollback configuration when the global flag is enabled', () => {
        const context = createContext({ rollbackAfterFailure: { update: ['count'] } })
        const subscriber = new StateSnapshotsSubscriberClass()
        subscriber.rollbackAfterFailure = true
        install(context, subscriber)

        expect(() => context.store.update(3, true)).toThrow('action failed')
        expect(context.store.count).toBe(0)
        expect(context.store.text).toBe('changed')
    })
})

describe('StateSnapshots', () => {
    it('installs and rolls back independently for store instances with the same id', () => {
        const first = createContext({ rollbackAfterFailure: { update: ['count'] } })
        const second = createContext({ rollbackAfterFailure: { update: ['count'] } })
        const plugin = new PluginSubscription([new StateSnapshotsSubscriberClass()])
        plugin.plugin(first)
        plugin.plugin(second)

        try {
            expect.soft(first.store.$rollbackAfterFailure).toBeTypeOf('function')
            expect.soft(second.store.$rollbackAfterFailure).toBeTypeOf('function')
            second.store.count = 10
            expect(() => first.store.update(3, true)).toThrow('action failed')
            expect.soft(first.store.count).toBe(0)
            expect.soft(second.store.count).toBe(10)

            expect(() => second.store.update(7, true)).toThrow('action failed')
            expect.soft(second.store.count).toBe(10)
            expect.soft(first.store.count).toBe(0)
        } finally {
            first.store.$dispose()
            second.store.$dispose()
        }
    })

    it('restores selected keys after a failing action but keeps successful changes', () => {
        const context = createContext({ rollbackAfterFailure: { update: ['count'] } })
        install(context)

        expect(context.store.update(2)).toBe(2)
        expect(() => context.store.update(7, true)).toThrow('action failed')
        expect(context.store.count).toBe(2)
        expect(context.store.text).toBe('changed')
    })

    it('tracks overlapping automatic snapshots independently', async () => {
        const context = createContext({ rollbackAfterFailure: { updateLater: 'all' } })
        install(context)
        let releaseFirst!: () => void
        let releaseSecond!: () => void
        const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
        const secondGate = new Promise<void>(resolve => { releaseSecond = resolve })
        const first = context.store.updateLater(1, firstGate)
        const second = context.store.updateLater(2, secondGate)

        releaseSecond()
        await expect(second).rejects.toThrow('failed 2')
        expect(context.store.count).toBe(1)
        releaseFirst()
        await expect(first).rejects.toThrow('failed 1')
        expect(context.store.count).toBe(0)
    })

    it('offers manual rollback with true without automatically rolling back actions', async () => {
        const context = createContext({ rollbackAfterFailure: true })
        install(context)

        expect(context.store.$onResetStore).toBeUndefined()
        expect(() => context.store.update(3, true)).toThrow('action failed')
        expect(context.store.count).toBe(3)
        await expect(context.store.$rollbackAfterFailure({ action: 'update', stateKeys: ['count'] }, [9, true]))
            .rejects.toThrow('action failed')
        expect(context.store.count).toBe(3)
        await expect(context.store.$rollbackAfterFailure({ action: 'update' }, [6])).resolves.toBeUndefined()
        expect(context.store.count).toBe(6)
        await expect(context.store.$rollbackAfterFailure({ action: '$reset' })).rejects.toThrow('Invalid rollback action')
        await expect(context.store.$rollbackAfterFailure({ action: 'missing' })).rejects.toThrow('Invalid rollback action')
    })

    it('releases pending snapshots when the store is disposed', async () => {
        const context = createContext({ rollbackAfterFailure: true })
        install(context)
        let release!: () => void
        const gate = new Promise<void>(resolve => { release = resolve })
        const pending = context.store.$rollbackAfterFailure({ action: 'updateLater' }, [7, gate])

        context.store.$dispose()
        release()
        await expect(pending).rejects.toThrow('failed 7')
        expect(context.store.count).toBe(7)
    })

    it('logs snapshot capture failures and runs the action without rolling back', () => {
        const context = createContext({ rollbackAfterFailure: { update: ['__proto__'] } })
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        install(context)

        expect(() => context.store.update(5, true)).toThrow('action failed')
        expect(context.store.count).toBe(5)
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining("Failed to create rollback snapshot for action 'update'"),
            expect.any(TypeError)
        )
    })

    it('preserves both errors for manual restoration failures', async () => {
        const context = createContext({ rollbackAfterFailure: true })
        install(context)
        const restoreError = new Error('patch failed')
        vi.spyOn(context.store, '$patch').mockImplementation(() => { throw restoreError })

        const error = await context.store.$rollbackAfterFailure({ action: 'update' }, [5, true])
            .catch((failure: unknown) => failure)
        expect(error).toBeInstanceOf(AggregateError)
        expect(error.errors).toEqual([expect.objectContaining({ message: 'action failed' }), restoreError])
    })

    it('logs automatic restoration failures while preserving the original error', () => {
        const context = createContext({ rollbackAfterFailure: { update: 'all' } })
        install(context)
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const restoreError = new Error('patch failed')
        vi.spyOn(context.store, '$patch').mockImplementation(() => { throw restoreError })

        expect(() => context.store.update(5, true)).toThrow('action failed')
        expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            errors: [expect.objectContaining({ message: 'action failed' }), restoreError]
        }))
    })

    it('resets from a fresh clone and runs callbacks after restoration, even if one fails', () => {
        const context = createContext({ overrideReset: true })
        install(context)
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        const callback = vi.fn()
        context.store.$onResetStore?.(() => { throw new Error('callback failed') })
        context.store.$onResetStore?.(callback)

        context.store.nested.value = 9
        context.store.$reset()
        expect(context.store.nested.value).toBe(1)
        expect(callback).toHaveBeenCalledWith(context.store)
        context.store.nested.value = 4
        context.store.$reset()
        expect(context.store.nested.value).toBe(1)
        expect(callback).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenCalled()
    })

    it('keeps the original reset when capturing initial state fails', () => {
        const context = createContext({ overrideReset: true })
        context.store.$state.unsupported = () => {}
        const original = context.store.$reset
        const log = vi.spyOn(console, 'error').mockImplementation(() => { })
        install(context)

        expect(context.store.$reset).toBe(original)
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Failed to capture initial reset state'), expect.any(Error))
    })
})
