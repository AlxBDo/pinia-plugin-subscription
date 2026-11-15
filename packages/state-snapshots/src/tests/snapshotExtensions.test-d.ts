import { describe, expectTypeOf, it } from 'vitest'
import type { PiniaCustomProperties } from 'pinia'
import type { StoreOptions } from 'pinia-plugin-subscription/types'
import type { RollbackActionParams, RollbackAfterFailureParams } from '../types'

describe('state snapshots type extensions', () => {
    it('adds rollback options and the manual method when the package types are imported', () => {
        expectTypeOf<StoreOptions['rollbackAfterFailure']>().toEqualTypeOf<RollbackAfterFailureParams | true | undefined>()
        const options: StoreOptions = { rollbackAfterFailure: { save: ['count'] } }
        expectTypeOf(options.rollbackAfterFailure).toEqualTypeOf<RollbackAfterFailureParams | true | undefined>()
        // @ts-expect-error false is not part of the opt-in contract
        const disabled: StoreOptions = { rollbackAfterFailure: false }
        expectTypeOf(disabled).toEqualTypeOf<StoreOptions>()
        expectTypeOf<PiniaCustomProperties['$rollbackAfterFailure']>()
            .toEqualTypeOf<((params: RollbackActionParams, args?: any[]) => Promise<void>) | undefined>()
        expectTypeOf<PiniaCustomProperties['$onResetStore']>()
            .toEqualTypeOf<((callback: import('../types').ResetStoreCallback) => void) | undefined>()
    })
})
