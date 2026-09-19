import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PiniaPluginContext, Store } from 'pinia'
import type { AnyObject } from '../types'
import type { RollbackAfterFailureParams } from '../types/store'
import RollbackStateSnapshotsHandler from '../core/RollbackStateSnapshotsHandler'

function createMockStore(id = 'test-store', state: AnyObject = { count: 0, name: 'initial' }): Store {
    const store: AnyObject = {
        $id: id,
        $state: state,
        $patch: vi.fn((partial: AnyObject) => {
            Object.assign(store.$state as AnyObject, partial)
        })
    }

    return store as unknown as Store
}

function createContext(store: Store, rollbackAfterFailure?: RollbackAfterFailureParams): PiniaPluginContext {
    return {
        store,
        options: rollbackAfterFailure ? { storeOptions: { rollbackAfterFailure } } : {}
    } as unknown as PiniaPluginContext
}

describe('RollbackStateSnapshotsHandler', () => {
    let handler: RollbackStateSnapshotsHandler
    let store: Store

    beforeEach(() => {
        handler = new RollbackStateSnapshotsHandler()
        store = createMockStore()
    })

    describe('addRollbackAction', () => {
        it('should add a $rollbackAfterFailure function to the store', () => {
            handler.addRollbackAction(store)

            expect(typeof (store as AnyObject).$rollbackAfterFailure).toBe('function')
        })

        it('should not override an existing $rollbackAfterFailure function', () => {
            const existing = vi.fn()
                ; (store as AnyObject).$rollbackAfterFailure = existing

            handler.addRollbackAction(store)

            expect((store as AnyObject).$rollbackAfterFailure).toBe(existing)
        })

        it('should ignore actions that are not functions on the store', async () => {
            handler.addRollbackAction(store)

            await (store as AnyObject).$rollbackAfterFailure({ action: 'unknownAction' })

            expect((handler as any)._stateSnapshots.size).toBe(0)
        })

        it.each(['_privateAction', '$dangerAction'])('should reject actions starting with "%s"', async (action) => {
            const actionFn = vi.fn()
                ; (store as AnyObject)[action] = actionFn
            handler.addRollbackAction(store)

            await (store as AnyObject).$rollbackAfterFailure({ action })

            expect(actionFn).not.toHaveBeenCalled()
        })

        it('should run the action with the provided arguments and keep the new state on success', async () => {
            const actionFn = vi.fn(function (this: AnyObject, amount: number) {
                this.$state.count += amount
            })
                ; (store as AnyObject).increment = actionFn
            handler.addRollbackAction(store)

            await (store as AnyObject).$rollbackAfterFailure({ action: 'increment' }, 5)

            expect(actionFn).toHaveBeenCalledWith(5)
            expect((store as AnyObject).$state.count).toBe(5)
            expect(store.$patch).not.toHaveBeenCalled()
        })

        it('should remove the snapshot once the action succeeds', async () => {
            ; (store as AnyObject).increment = vi.fn()
            handler.addRollbackAction(store)

            await (store as AnyObject).$rollbackAfterFailure({ action: 'increment' })

            expect((handler as any)._stateSnapshots.size).toBe(0)
        })

        it('should restore the whole state when the action fails and no stateKeys are provided', async () => {
            ; (store as AnyObject).mutateAndFail = vi.fn(function (this: AnyObject) {
                this.$state.count = 42
                this.$state.name = 'mutated'
                throw new Error('action failed')
            })
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'mutateAndFail' }))
                .rejects.toThrow('action failed')

            expect((store as AnyObject).$state).toEqual({ count: 0, name: 'initial' })
            expect(store.$patch).toHaveBeenCalledTimes(1)
        })

        it('should restore the whole state when stateKeys is an empty array', async () => {
            ; (store as AnyObject).mutateAndFail = vi.fn(function (this: AnyObject) {
                this.$state.count = 10
                this.$state.name = 'mutated'
                throw new Error('action failed')
            })
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'mutateAndFail', stateKeys: [] }))
                .rejects.toThrow('action failed')

            expect((store as AnyObject).$state).toEqual({ count: 0, name: 'initial' })
        })

        it('should restore only the given stateKeys when the action fails', async () => {
            ; (store as AnyObject).mutateAndFail = vi.fn(function (this: AnyObject) {
                this.$state.count = 10
                this.$state.name = 'mutated'
                throw new Error('action failed')
            })
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'mutateAndFail', stateKeys: ['count'] }))
                .rejects.toThrow('action failed')

            expect((store as AnyObject).$state.count).toBe(0)
            expect((store as AnyObject).$state.name).toBe('mutated')
        })

        it('should restore nested objects by value when the action fails', async () => {
            store = createMockStore('nested-store', { user: { name: 'Ada', tags: ['a'] } })
                ; (store as AnyObject).mutateAndFail = vi.fn(function (this: AnyObject) {
                    this.$state.user.name = 'Grace'
                    this.$state.user.tags.push('b')
                    throw new Error('action failed')
                })
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'mutateAndFail' }))
                .rejects.toThrow('action failed')

            expect((store as AnyObject).$state.user).toEqual({ name: 'Ada', tags: ['a'] })
        })

        it('should remove the snapshot after an asynchronous failure', async () => {
            ; (store as AnyObject).fail = vi.fn(() => Promise.reject(new Error('async failure')))
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'fail' }))
                .rejects.toThrow('async failure')

            expect((handler as any)._stateSnapshots.size).toBe(0)
        })

        it('should log an error and rethrow the original error when $patch fails during rollback', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
                ; (store as AnyObject).$patch = vi.fn(() => { throw new Error('patch failed') })
                ; (store as AnyObject).fail = vi.fn(() => { throw new Error('action failed') })
            handler.addRollbackAction(store)

            await expect((store as AnyObject).$rollbackAfterFailure({ action: 'fail' }))
                .rejects.toThrow('action failed')

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
            consoleErrorSpy.mockRestore()
        })
    })

    describe('createOnActionCallbacks', () => {
        it('should return undefined when no rollback params are registered for the action', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))

            expect(handler.createOnActionCallbacks('unknownAction', store)).toBeUndefined()
        })

        it('should return undefined when the registered stateKeys array is empty', () => {
            handler.initFromPluginContext(createContext(store, { update: [] }))

            expect(handler.createOnActionCallbacks('update', store)).toBeUndefined()
        })

        it('should save a snapshot for the registered action', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))

            const callbacks = handler.createOnActionCallbacks('update', store)

            expect(callbacks).toBeDefined()
            expect((handler as any)._stateSnapshots.size).toBe(1)
        })

        it('after should remove the snapshot without patching the store', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))
            const callbacks = handler.createOnActionCallbacks('update', store)

            callbacks!.after()

            expect((handler as any)._stateSnapshots.size).toBe(0)
            expect(store.$patch).not.toHaveBeenCalled()
        })

        it('onError should restore the snapshotted keys and remove the snapshot', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))
            const callbacks = handler.createOnActionCallbacks('update', store)
                ; (store as AnyObject).$state.count = 99
                ; (store as AnyObject).$state.name = 'mutated'

            callbacks!.onError()

            expect((store as AnyObject).$state.count).toBe(0)
            expect((store as AnyObject).$state.name).toBe('mutated')
            expect((handler as any)._stateSnapshots.size).toBe(0)
        })

        it('should snapshot the whole state when the action is registered with "all"', () => {
            handler.initFromPluginContext(createContext(store, { update: 'all' }))
            const callbacks = handler.createOnActionCallbacks('update', store)
                ; (store as AnyObject).$state.count = 99
                ; (store as AnyObject).$state.name = 'mutated'

            callbacks!.onError()

            expect((store as AnyObject).$state).toEqual({ count: 0, name: 'initial' })
        })
    })

    describe('initFromPluginContext', () => {
        it('should register rollback params for each declared action', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'], destroy: 'all' }))

            expect((handler as any)._storeRollbackSnapshotsParams.get('update-test-store')).toEqual(['count'])
            expect((handler as any)._storeRollbackSnapshotsParams.get('destroy-test-store')).toBe('all')
            expect(handler.storeHasRollbackSnapshots(store)).toBe(true)
        })

        it('should not register params twice for the same store', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))

            handler.initFromPluginContext(createContext(store, { update: ['name'], other: 'all' }))

            expect((handler as any)._storeRollbackSnapshotsParams.get('update-test-store')).toEqual(['count'])
            expect((handler as any)._storeRollbackSnapshotsParams.get('other-test-store')).toBeUndefined()
        })

        it('should still add the rollback action when no params are declared', () => {
            handler.initFromPluginContext(createContext(store))

            expect(typeof (store as AnyObject).$rollbackAfterFailure).toBe('function')
            expect(handler.storeHasRollbackSnapshots(store)).toBe(false)
        })
    })

    describe('clearStoreTracking', () => {
        it('should remove registered params and the tracking flag for the store', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))

            handler.clearStoreTracking(store)

            expect(handler.storeHasRollbackSnapshots(store)).toBe(false)
            expect(handler.createOnActionCallbacks('update', store)).toBeUndefined()
        })

        it('should not remove params of other stores', () => {
            const otherStore = createMockStore('other-store')
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))
            handler.initFromPluginContext(createContext(otherStore, { update: ['count'] }))

            handler.clearStoreTracking(store)

            expect(handler.storeHasRollbackSnapshots(otherStore)).toBe(true)
            expect(handler.createOnActionCallbacks('update', otherStore)).toBeDefined()
        })

        it('should remove pending snapshots of the disposed store only', () => {
            const otherStore = createMockStore('other-store')
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))
            handler.initFromPluginContext(createContext(otherStore, { update: ['count'] }))
            handler.createOnActionCallbacks('update', store)
            handler.createOnActionCallbacks('update', otherStore)

            handler.clearStoreTracking(store)

            expect((handler as any)._stateSnapshots.size).toBe(1)
            const [remainingKey] = Array.from((handler as any)._stateSnapshots.keys()) as symbol[]
            expect(remainingKey.description).toBe('other-store:update')
        })

        it('should allow re-registering params after cleanup', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))
            handler.clearStoreTracking(store)

            handler.initFromPluginContext(createContext(store, { update: ['name'] }))

            expect(handler.storeHasRollbackSnapshots(store)).toBe(true)
            expect((handler as any)._storeRollbackSnapshotsParams.get('update-test-store')).toEqual(['name'])
        })
    })

    describe('storeHasRollbackSnapshots', () => {
        it('should return false for an unknown store', () => {
            expect(handler.storeHasRollbackSnapshots(store)).toBe(false)
        })

        it('should return true after initialization with rollback params', () => {
            handler.initFromPluginContext(createContext(store, { update: ['count'] }))

            expect(handler.storeHasRollbackSnapshots(store)).toBe(true)
        })
    })

    describe('defensive guards', () => {
        it('patchStore should do nothing when the snapshot does not exist', () => {
            expect(() => (handler as any).patchStore(Symbol('missing'), store)).not.toThrow()
            expect(store.$patch).not.toHaveBeenCalled()
        })

        it('removeStateSnapshot should do nothing when no snapshot key is provided', () => {
            expect(() => (handler as any).removeStateSnapshot(undefined)).not.toThrow()
            expect((handler as any)._stateSnapshots.size).toBe(0)
        })
    })
})
