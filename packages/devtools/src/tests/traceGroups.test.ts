import { describe, expect, it } from 'vitest'
import { getTraceGroupName } from '../utils/traceGroups'

describe('getTraceGroupName', () => {
    it('names a group by its last segment, without call counter', () => {
        expect(getTraceGroupName('cart/plugin')).toBe('Plugin setup')
        expect(getTraceGroupName('cart/onAction:add#3')).toBe('onAction \u00b7 add')
        expect(getTraceGroupName('cart/onAction:add#3/onError')).toBe('onError')
        expect(getTraceGroupName('custom')).toBe('custom')
    })
})
