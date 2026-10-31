import { journalGlobalScope } from '../utils/constants'
import { isContextEvent } from '../utils/traceContext'
import { toSerializable } from '../utils/toSerializable'

import type {
    AnyObject
} from '../types'
import type {
    TraceEvent,
    TraceJournal,
    TraceJournalListener,
    TraceJournalOptions,
    TraceJournalSnapshot,
    TraceSide
} from '../types/trace'

const defaultMaxEventsPerStore = 1000

interface ScopeEntry {
    dropped: number
    /** Context and error events: evicted separately so that they outlive the regular flow. */
    kept: TraceEvent[]
    /** One ring per side, so that imported server events are not evicted by client events. */
    rings: Record<TraceSide, TraceEvent[]>
}

/** Context and error events are the ones needed to understand a store whatever its age. */
function isKept(event: TraceEvent): boolean {
    return event.level === 'error' || isContextEvent(event)
}

function pushCapped(events: TraceEvent[], event: TraceEvent, max: number): number {
    events.push(event)
    const overflow = events.length - max
    if (overflow > 0) {
        events.splice(0, overflow)
        return overflow
    }
    return 0
}

/** Rebuilds an event from untrusted data, copying known fields only. */
function toImportedEvent(raw: unknown): TraceEvent | undefined {
    if (!raw || typeof raw !== 'object') { return }

    const { error, label, level, namespace, payload, seq, source, timestamp } = raw as Record<string, unknown>
    if (
        typeof label !== 'string' || typeof namespace !== 'string' || typeof source !== 'string'
        || (level !== 'debug' && level !== 'error')
        || typeof seq !== 'number' || !Number.isFinite(seq)
        || typeof timestamp !== 'number'
    ) { return }

    const { actionId, groupId, scope } = raw as Record<string, unknown>
    return {
        ...(typeof actionId === 'string' && { actionId }),
        ...(error !== undefined && { error }),
        ...(typeof groupId === 'string' && { groupId }),
        label,
        level,
        namespace,
        ...(typeof payload === 'object' && payload !== null && { payload: payload as AnyObject }),
        ...(typeof scope === 'string' && { scope }),
        seq,
        side: 'server',
        source,
        timestamp
    }
}

/**
 * Creates the journal of a registry.
 * @param options Size cap of the journal.
 */
export function createTraceJournal({ maxEventsPerStore }: TraceJournalOptions = {}): TraceJournal {
    const max = Math.max(1, Math.floor(maxEventsPerStore ?? defaultMaxEventsPerStore))
    const entries = new Map<string, ScopeEntry>()
    const listeners = new Set<TraceJournalListener>()
    let seq = 0

    function getEntry(scope: string): ScopeEntry {
        let entry = entries.get(scope)
        if (!entry) {
            entry = { dropped: 0, kept: [], rings: { client: [], server: [] } }
            entries.set(scope, entry)
        }
        return entry
    }

    function removeServerEvents() {
        entries.forEach(entry => {
            entry.rings.server = []
            entry.kept = entry.kept.filter(event => event.side !== 'server')
        })
    }

    function getAllEvents(): TraceEvent[] {
        return [...entries.keys()]
            .flatMap(scope => getEvents(scope))
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }

    function getEvents(scope: string): TraceEvent[] {
        const entry = entries.get(scope)
        if (!entry) { return [] }

        return [...entry.kept, ...entry.rings.client, ...entry.rings.server]
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }

    return {
        append(event) {
            const entry = getEntry(event.scope ?? journalGlobalScope)
            const target = isKept(event) ? entry.kept : entry.rings[event.side ?? 'client']
            entry.dropped += pushCapped(target, event, max)

            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (error) {
                    // a faulty subscriber must never break the traced code
                    console.error('Error in trace journal listener:', error)
                }
            })
        },
        clear(scope) {
            if (scope === undefined) {
                entries.clear()
            } else {
                entries.delete(scope)
            }
        },
        getDropped: scope => entries.get(scope)?.dropped ?? 0,
        getEvents,
        getScopes: () => [...entries.keys()],
        import(snapshot) {
            const raw = (snapshot as Partial<TraceJournalSnapshot> | null)?.events
            if (!Array.isArray(raw)) { return 0 }

            const events = raw.map(toImportedEvent).filter((event): event is TraceEvent => !!event)
            const lastSeq = events.reduce((highest, event) => Math.max(highest, event.seq ?? 0), 0)

            removeServerEvents()
            // Negative sequence numbers keep imported events before every local one, whatever the server counter was.
            events.forEach(event => this.append({ ...event, seq: (event.seq ?? 0) - lastSeq - 1 }))

            return events.length
        },
        nextSeq: () => ++seq,
        serialize: () => ({
            events: getAllEvents().map(({ error, payload, ...event }) => ({
                ...event,
                ...(error !== undefined && { error: toSerializable(error) }),
                ...(payload !== undefined && { payload: toSerializable(payload) as AnyObject })
            })),
            version: 1
        }),
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        }
    }
}
