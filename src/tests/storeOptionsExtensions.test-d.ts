import { describe, it, expectTypeOf } from 'vitest'

import type { StoreOptions, StoreOptionsExtensions } from '../types'
import type { RollbackAfterFailureParams } from '../types/store'

/**
 * Compile-only contract for the centralized store-options extension point.
 * Simulates a subscriber plugin augmenting the contract through interface
 * merging, instead of redeclaring pinia's `DefineStoreOptionsBase` (which
 * would raise TS2717 on type mismatch in consumer projects).
 */
declare module '../types' {
    interface StoreOptionsExtensions {
        testExtension?: string
    }
}

describe('StoreOptionsExtensions contract', () => {
    it('exposes extension keys declared through interface merging', () => {
        expectTypeOf<StoreOptionsExtensions['testExtension']>().toEqualTypeOf<string | undefined>()
    })

    it('flows extension keys into StoreOptions without altering built-in options', () => {
        expectTypeOf<StoreOptions['testExtension']>().toEqualTypeOf<string | undefined>()
        expectTypeOf<StoreOptions['rollbackAfterFailure']>().toEqualTypeOf<RollbackAfterFailureParams | undefined>()
    })

    it('accepts extension keys in store options literals', () => {
        // Compile-only: this assignment fails typecheck if extension keys
        // are not accepted on StoreOptions.
        const options: StoreOptions = { testExtension: 'value', rollbackAfterFailure: { save: 'all' } }

        expectTypeOf(options.testExtension).toEqualTypeOf<string | undefined>()
    })
})
