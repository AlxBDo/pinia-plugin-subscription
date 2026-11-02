import { describe, expect, it } from 'vitest'
import { buildTimeline, defaultTimelineFilters, filterTimeline, findContextEvent, getEventDetail } from '../panel/model'

import type { TraceEvent } from '../types/trace'
import type { TraceTimelineGroup } from '../types/devtools'

const ev = (seq: number, extra: Partial<TraceEvent> = {}): TraceEvent =>
    ({ label: `L${seq}`, level: 'debug', namespace: 'ns', scope: 'cart', seq, side: 'client', source: 'S', timestamp: seq, ...extra })

const group = (entry: unknown) => entry as TraceTimelineGroup

describe('devtools model', () => {
    const events = [
        ev(1, { namespace: 'pluginsubscription:context' }),
        ev(2, { groupId: 'cart/onAction:add#1' }),
        ev(3),
        ev(4, { groupId: 'cart/onAction:add#1/after' }),
        ev(5, { groupId: 'cart/onAction:add#1/after', level: 'error' }),
        ev(6, { groupId: 'cart/plugin', side: 'server', label: 'Hydrate' })
    ]

    it('nests the events by lifecycle and leaves context out', () => {
        const timeline = buildTimeline(events)

        expect(timeline.map(entry => entry.kind)).toEqual(['group', 'event', 'group'])
        const action = group(timeline[0])
        expect(action).toMatchObject({ count: 3, hasError: true, title: 'onAction \u00b7 add' })
        expect(action.items.map(item => item.kind)).toEqual(['event', 'group'])
        expect(group(action.items[1])).toMatchObject({ count: 2, hasError: true, title: 'after' })
        expect(group(timeline[2])).toMatchObject({ side: 'server', title: 'Plugin setup' })
    })

    it('merges the calls of a same hook into a single group', () => {
        const timeline = buildTimeline([
            ev(1, { groupId: 'cart/onAction:add#1' }),
            ev(2, { groupId: 'cart/onAction:add#1/after' }),
            ev(3, { groupId: 'cart/onAction:add#2' }),
            ev(4, { groupId: 'cart/onAction:add#2/after' }),
            ev(5, { groupId: 'cart/onMutation#3' }),
            ev(6, { groupId: 'cart/onMutation#4' })
        ])

        expect(timeline.map(entry => group(entry).title)).toEqual(['onAction \u00b7 add', 'onMutation'])
        expect(group(timeline[0])).toMatchObject({ count: 4 })
        expect(group(timeline[0]).items.filter(item => item.kind === 'group')).toHaveLength(1)
    })

    it('merges the groups of pinia-plugin-extending-store into the plugin lifecycle groups', () => {
        const timeline = buildTimeline([
            ev(1, { groupId: 'cart/reset#1' }),
            ev(2, { groupId: 'store:reset:cart' }),
            ev(3, { groupId: 'cart/onMutation#2' }),
            ev(4, { groupId: 'store:onMutation:cart' })
        ])

        expect(timeline.map(entry => group(entry).title)).toEqual(['reset', 'onMutation'])
        expect(timeline.map(entry => group(entry).count)).toEqual([2, 2])
    })

    it('keeps the same lifecycle of both sides apart', () => {
        const timeline = buildTimeline([ev(1, { groupId: 'cart/plugin' }), ev(2, { groupId: 'cart/plugin', side: 'server' })])

        expect(timeline).toHaveLength(2)
    })

    it('filters by side, level and text, dropping empty groups', () => {
        const timeline = buildTimeline(events)

        expect(filterTimeline(timeline, { ...defaultTimelineFilters, side: 'server' }).map(entry => entry.kind)).toEqual(['group'])
        const errors = filterTimeline(timeline, { ...defaultTimelineFilters, level: 'error' })
        expect(errors).toHaveLength(1)
        expect(group(errors[0])).toMatchObject({ count: 1, hasError: true })
        expect(filterTimeline(timeline, { ...defaultTimelineFilters, text: 'hydr' })).toHaveLength(1)
        expect(group(filterTimeline(timeline, { ...defaultTimelineFilters, text: 'add#1' })[0]).count).toBe(3)
    })

    it('only reports the error and payload an event carries', () => {
        expect(getEventDetail(ev(1))).toEqual({})
        expect(getEventDetail(ev(1, { payload: {} }))).toEqual({})
        expect(getEventDetail(ev(1, { payload: { a: 1 } }))).toEqual({ a: 1 })
        expect(getEventDetail(ev(1, { error: new Error('x') }))).toHaveProperty('error')
    })

    it('finds the latest context event', () => {
        expect(findContextEvent(events)?.seq).toBe(1)
        expect(findContextEvent([ev(2)])).toBeUndefined()
    })
})
