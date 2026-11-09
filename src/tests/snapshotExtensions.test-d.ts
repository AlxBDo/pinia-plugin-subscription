import { describe, expectTypeOf, it } from 'vitest'
import type { PiniaCustomProperties } from 'pinia'
import type { StoreOptions } from '../types'
import type { RollbackActionParams, RollbackAfterFailureParams } from '../../packages/state-snapshots/src/types'

describe('state snapshots type extensions', () => {
    it('adds rollback options and the manual method when the package types are imported', () => {
        expectTypeOf<StoreOptions['rollbackAfterFailure']>().toEqualTypeOf<RollbackAfterFailureParams | undefined>()
        const options: StoreOptions = { rollbackAfterFailure: { save: ['count'] } }
        expectTypeOf(options.rollbackAfterFailure).toEqualTypeOf<RollbackAfterFailureParams | undefined>()
        expectTypeOf<PiniaCustomProperties['$rollbackAfterFailure']>()
            .toEqualTypeOf<(params: RollbackActionParams, args?: any[]) => Promise<void>>()
    })
})
