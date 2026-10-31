import { isContextEvent } from '../utils/traceContext'

import type { TraceEvent, TraceJournal } from '../types/trace'
import type { TraceStoreSummary, TraceTimelineEntry, TraceTimelineFilters } from '../types/devtools'

export const defaultTimelineFilters: TraceTimelineFilters = { level: 'all', side: 'all', text: '' }

/** Groups the events of an action in one entry; context events belong to the Context tab and are left out. */
export function buildTimeline(events: TraceEvent[]): TraceTimelineEntry[] {
    const entries: TraceTimelineEntry[] = []
    const byAction = new Map<string, TraceTimelineEntry>()

    for (const event of events) {
        if (isContextEvent(event)) { continue }

        const seq = event.seq ?? 0
        const existing = event.actionId ? byAction.get(event.actionId) : undefined
        if (existing) {
            existing.events.push(event)
            existing.hasError ||= event.level === 'error'
            continue
        }

        const entry: TraceTimelineEntry = {
            actionId: event.actionId,
            events: [event],
            hasError: event.level === 'error',
            id: event.actionId ?? `event:${event.side ?? 'client'}:${seq}`,
            seq
        }
        entries.push(entry)
        if (event.actionId) { byAction.set(event.actionId, entry) }
    }

    return entries.sort((a, b) => a.seq - b.seq)
}

function matchesFilters(event: TraceEvent, { level, side, text }: TraceTimelineFilters): boolean {
    if (level === 'error' && event.level !== 'error') { return false }
    if (side !== 'all' && (event.side ?? 'client') !== side) { return false }
    if (!text) { return true }

    const needle = text.toLowerCase()
    return [event.label, event.namespace, event.actionId ?? ''].some(value => value.toLowerCase().includes(needle))
}

/** Keeps the events matching the filters, and drops entries left empty. */
export function filterTimeline(entries: TraceTimelineEntry[], filters: TraceTimelineFilters): TraceTimelineEntry[] {
    return entries.flatMap(entry => {
        const events = entry.events.filter(event => matchesFilters(event, filters))
        return events.length ? [{ ...entry, events, hasError: events.some(event => event.level === 'error') }] : []
    })
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
