import { isContextEvent } from '../utils/traceContext'
import { getTraceGroupName } from '../utils/traceGroups'

import type { TraceEvent, TraceJournal } from '../types/trace'
import type {
    TraceEventDetail,
    TraceStoreSummary,
    TraceTimelineEntry,
    TraceTimelineFilters,
    TraceTimelineGroup
} from '../types/devtools'

export const defaultTimelineFilters: TraceTimelineFilters = { level: 'all', side: 'all', text: '' }

function isGroup(entry: TraceTimelineEntry): entry is TraceTimelineGroup {
    return entry.kind === 'group'
}

/**
 * Only the parts an event actually carries: no `error` / `payload` key when they are undefined or empty.
 */
export function getEventDetail(event: TraceEvent): TraceEventDetail {
    const hasPayload = !!event.payload && Object.keys(event.payload).length > 0
    return {
        ...(hasPayload && event.payload),
        ...(event.error !== undefined && { error: event.error })
    }
}

/** Calls of a same hook share one group: the `#n` call counter is dropped from the path. */
const stripCallCounter = (segment: string): string => segment.replace(/#\d+/g, '')

/** Group ids built by pinia-plugin-extending-store (`store:reset:<id>`) join the matching lifecycle group of the plugin. */
const legacyHookGroup = /^store:(reset|onMutation):/

/** Group path of an event, without the store segment (the timeline already is per store). */
function groupSegments(event: TraceEvent): string[] {
    const legacyHook = legacyHookGroup.exec(event.groupId ?? '')?.[1]
    if (legacyHook) { return [legacyHook] }

    const segments = (event.groupId ?? '').split('/').filter(Boolean)
    return (segments.length > 1 && segments[0] === event.scope ? segments.slice(1) : segments).map(stripCallCounter)
}

/**
 * Nests the events by lifecycle: the `groupId` path gives the groups, so `after` and `onError` are
 * sub-groups of their `onAction`. Events without group stay at the root. Context events belong to the Context tab.
 */
export function buildTimeline(events: TraceEvent[]): TraceTimelineEntry[] {
    const root: TraceTimelineEntry[] = []
    const groups = new Map<string, TraceTimelineGroup>()

    const sorted = events
        .filter(event => !isContextEvent(event))
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

    for (const event of sorted) {
        const seq = event.seq ?? 0
        const side = event.side ?? 'client'
        const segments = groupSegments(event)
        let items = root
        const chain: TraceTimelineGroup[] = []

        segments.forEach((_, index) => {
            const path = segments.slice(0, index + 1).join('/')
            const key = `${side}|${path}`
            let group = groups.get(key)
            if (!group) {
                group = { count: 0, groupId: path, hasError: false, id: key, items: [], kind: 'group', seq, side, title: getTraceGroupName(path) }
                groups.set(key, group)
                items.push(group)
            }
            chain.push(group)
            items = group.items
        })

        items.push({ event, hasError: event.level === 'error', id: `event:${side}:${seq}`, kind: 'event', seq })
        chain.forEach(group => {
            group.count++
            group.hasError ||= event.level === 'error'
        })
    }

    return root
}

function matchesFilters(event: TraceEvent, { level, side, text }: TraceTimelineFilters): boolean {
    if (level === 'error' && event.level !== 'error') { return false }
    if (side !== 'all' && (event.side ?? 'client') !== side) { return false }
    if (!text) { return true }

    const needle = text.toLowerCase()
    return [event.label, event.namespace, event.actionId ?? '', event.groupId ?? ''].some(value => value.toLowerCase().includes(needle))
}

function summarize(items: TraceTimelineEntry[]): Pick<TraceTimelineGroup, 'count' | 'hasError'> {
    return items.reduce<Pick<TraceTimelineGroup, 'count' | 'hasError'>>((total, item) => ({
        count: total.count + (isGroup(item) ? item.count : 1),
        hasError: total.hasError || item.hasError
    }), { count: 0, hasError: false })
}

function filterEntries(entries: TraceTimelineEntry[], filters: TraceTimelineFilters): TraceTimelineEntry[] {
    return entries.flatMap(entry => {
        if (!isGroup(entry)) { return matchesFilters(entry.event, filters) ? [entry] : [] }

        const items = filterEntries(entry.items, filters)
        return items.length ? [{ ...entry, ...summarize(items), items } as TraceTimelineEntry] : []
    })
}

/** Keeps the events matching the filters, and drops groups left empty. */
export function filterTimeline(entries: TraceTimelineEntry[], filters: TraceTimelineFilters): TraceTimelineEntry[] {
    return filterEntries(entries, filters)
}

/** Most recent context event of a store: store, subscribers, hooks subscriptions and options. */
export function findContextEvent(events: TraceEvent[]): TraceEvent | undefined {
    return [...events].reverse().find(isContextEvent)
}

export function summarizeStores(journal: TraceJournal): TraceStoreSummary[] {
    return journal.getScopes().map(scope => {
        const events = journal.getEvents(scope)
        return {
            dropped: journal.getDropped(scope),
            errors: events.filter(event => event.level === 'error').length,
            events: events.length,
            scope
        }
    })
}
