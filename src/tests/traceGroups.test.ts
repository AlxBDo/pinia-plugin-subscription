import { describe, expect, it } from 'vitest'
import { traceGroups } from '../utils/traceGroups'

describe('traceGroups', () => {
    it('builds group ids as paths, after and onError being sub-groups of their onAction', () => {
        expect(traceGroups.plugin('cart')).toBe('cart/plugin')
        expect(traceGroups.onAction('cart', 'add', 3)).toBe('cart/onAction:add#3')
        expect(traceGroups.onActionAfter('cart', 'add', 3)).toBe('cart/onAction:add#3/after')
        expect(traceGroups.onActionError('cart', 'add', 3)).toBe('cart/onAction:add#3/onError')
        expect(traceGroups.onMutation('cart', 4)).toBe('cart/onMutation#4')
        expect(traceGroups.reset('cart', 5)).toBe('cart/reset#5')
        expect(traceGroups.pluginDeferred('cart', 'persist', 6)).toBe('cart/plugin/deferred:persist#6')
    })
})
