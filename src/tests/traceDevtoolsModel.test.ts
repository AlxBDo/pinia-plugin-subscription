import { describe, expect, it } from 'vitest'
import { buildTimeline, defaultTimelineFilters, filterTimeline, findContextEvent } from '../devtools/model'

import type { TraceEvent } from '../types/trace'

const ev = (seq: number, extra: Partial<TraceEvent> = {}): TraceEvent =>
    ({ label: `L${seq}`, level: 'debug', namespace: 'ns', seq, side: 'client', source: 'S', timestamp: seq, ...extra })

describe('devtools model', () => {
    const events = [
        ev(1, { namespace: 'pluginsubscription:context' }),
        ev(2, { actionId: 'a#1' }),
        ev(3),
        ev(4, { actionId: 'a#1', level: 'error' }),
        ev(5, { side: 'server', label: 'Hydrate' })
    ]

    it('groups events of an action and leaves context out', () => {
        const timeline = buildTimeline(events)

        expect(timeline.map(entry => [entry.id, entry.events.length, entry.hasError])).toEqual([
            ['a#1', 2, true], ['event:client:3', 1, false], ['event:server:5', 1, false]
        ])
    })

    it('filters by side, level and text, dropping empty entries', () => {
        const timeline = buildTimeline(events)

        expect(filterTimeline(timeline, { ...defaultTimelineFilters, side: 'server' }).map(entry => entry.id)).toEqual(['event:server:5'])
        expect(filterTimeline(timeline, { ...defaultTimelineFilters, level: 'error' })[0]!.events).toHaveLength(1)
        expect(filterTimeline(timeline, { ...defaultTimelineFilters, text: 'hydr' })).toHaveLength(1)
        expect(filterTimeline(timeline, { ...defaultTimelineFilters, text: 'a#1' })[0]!.events).toHaveLength(2)
    })

    it('finds the latest context event', () => {
        expect(findContextEvent(events)?.seq).toBe(1)
        expect(findContextEvent([ev(2)])).toBeUndefined()
    })
})
