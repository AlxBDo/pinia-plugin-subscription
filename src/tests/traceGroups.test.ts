import { describe, expect, it } from 'vitest'
import { traceGroups } from '../utils/traceGroups'

describe('traceGroups', () => {
    it('builds the group id of a store', () => {
        expect(traceGroups.onActionAfter('cart')).toBe('store:onAction:after:cart')
        expect(traceGroups.onActionError('cart')).toBe('store:onAction:onError:cart')
        expect(traceGroups.onMutation('cart')).toBe('store:onMutation:cart')
        expect(traceGroups.reset('cart')).toBe('store:reset:cart')
    })
})
