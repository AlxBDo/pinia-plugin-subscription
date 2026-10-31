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

export interface TraceTimelineEntry {
    /** Shared by the events of an action; the event `seq` for standalone events. */
    id: string
    actionId?: string
    events: TraceEvent[]
    hasError: boolean
    /** `seq` of the first event, used for ordering. */
    seq: number
}

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
