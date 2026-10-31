import type { TraceEvent, TraceSide } from './trace'

export interface TraceDevtoolsHandle {
    close: () => void
    open: () => void
    toggle: () => void
    /** Removes the panel and its listeners from the page. */
    unmount: () => void
}

export interface TraceDevtoolsOptions {
    /** Element the panel host is appended to. Defaults to `document.body`. */
    container?: HTMLElement
    /** Side of the page the aside is attached to. Defaults to `right`. */
    position?: 'left' | 'right'
    /** Opens the panel on mount. Defaults to `false`. */
    open?: boolean
    /** Toggle shortcut such as `Alt+Shift+P`, or `false` to disable it. Defaults to `Alt+Shift+P`. */
    shortcut?: string | false
    /** Width of the aside in pixels. Defaults to `480`. */
    width?: number
}

/** Parts of an event worth displaying: its payload content directly, plus `error` when present. */
export type TraceEventDetail = Record<string, unknown>

export interface TraceTimelineEventEntry {
    event: TraceEvent
    hasError: boolean
    id: string
    kind: 'event'
    /** Position of the event, used for ordering. */
    seq: number
}

/** A lifecycle (plugin setup, `$onAction` call, `after`...) holding its events and sub-groups in order. */
export interface TraceTimelineGroup {
    /** Number of events of the group, sub-groups included. */
    count: number
    groupId: string
    hasError: boolean
    id: string
    items: TraceTimelineEntry[]
    kind: 'group'
    seq: number
    side: TraceSide
    /** Readable name, without call counter. */
    title: string
}

export type TraceTimelineEntry = TraceTimelineEventEntry | TraceTimelineGroup

export interface TraceTimelineFilters {
    level: 'all' | 'error'
    side: 'all' | TraceSide
    text: string
}

export interface TraceStoreSummary {
    dropped: number
    errors: number
    events: number
    scope: string
}
