import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, type PropType, type VNode } from 'vue'
import { toSerializable } from '../utils/toSerializable'
import { buildContextView } from '../utils/traceContext'
import { buildTimeline, defaultTimelineFilters, filterTimeline, findContextEvent, getEventDetail, summarizeStores } from './model'

import type { TraceJournal, TraceEvent } from '../types/trace'
import type { TraceDevtoolsOptions, TraceTimelineEntry, TraceTimelineFilters, TraceTimelineGroup } from '../types/devtools'

export interface DevtoolsState {
    expanded: Record<string, boolean>
    filters: TraceTimelineFilters
    open: boolean
    scope?: string
    tab: 'context' | 'timeline'
}

const serializedCache = new WeakMap<object, unknown>()

function serializedOf(owner: object, value: unknown): unknown {
    if (!serializedCache.has(owner)) { serializedCache.set(owner, toSerializable(value)) }
    return serializedCache.get(owner)
}

function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (value: number, size = 2) => String(value).padStart(size, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

/** Renders text only (never HTML), so payload content can never inject markup. */
function renderValue(key: string | undefined, value: unknown, depth = 0): VNode {
    const keyNode = key === undefined ? [] : [h('span', { class: 'pps-key' }, `${key}: `)]

    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as object)
        const summary = Array.isArray(value) ? `Array(${entries.length})` : `{${entries.length}}`
        return h('details', { class: 'pps-tree', open: depth < 1 }, [
            h('summary', null, [...keyNode, h('span', { class: 'pps-muted' }, summary)]),
            ...entries.map(([childKey, child]) => renderValue(childKey, child, depth + 1))
        ])
    }

    return h('div', { class: 'pps-tree' }, [
        ...keyNode,
        h('span', { class: typeof value === 'number' ? 'pps-num' : 'pps-str' }, String(value))
    ])
}

const bugIcon = () => h('svg', { 'aria-hidden': 'true', class: 'pps-icon', viewBox: '0 0 24 24' }, [
    h('path', { d: 'M20 8h-2.81a6 6 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17a6 6 0 0 0-2.83 0L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z' })
])

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error'
}

function chip(kind: 'e' | 'p', label: string, title: string): VNode {
    return h('span', { 'aria-label': title, class: ['pps-chip', kind], title }, label)
}

function renderEvent(event: TraceEvent, state: DevtoolsState): VNode {
    const id = `${event.side}:${event.seq}`
    const detail = getEventDetail(event)
    const hasError = 'error' in detail
    const hasPayload = Object.keys(detail).some(key => key !== 'error') || (hasError && !!event.payload && Object.keys(event.payload).length > 0)
    const hasDetail = hasError || hasPayload
    const expanded = hasDetail && !!state.expanded[id]

    return h('div', null, [
        h('button', {
            class: ['pps-row', 'pps-event', { 'pps-error': event.level === 'error', 'pps-static': !hasDetail }],
            onClick: () => { if (hasDetail) { state.expanded[id] = !expanded } }
        }, [
            h('span', { class: 'pps-label' }, event.label),
            h('span', { class: 'pps-meta' }, [
                h('span', { class: 'pps-muted' }, formatTime(event.timestamp)),
                h('span', { class: ['pps-badge', event.side ?? 'client'] }, event.side ?? 'client'),
                hasPayload ? chip('p', 'P', 'Payload') : null,
                hasError ? chip('e', 'E', `Error: ${errorMessage(detail.error)}`) : null
            ])
        ]),
        expanded ? renderValue(undefined, serializedOf(event, detail)) : null
    ])
}

export const TraceDevtoolsPanel = defineComponent({
    name: 'TraceDevtoolsPanel',
    props: {
        journal: { required: true, type: Object as PropType<TraceJournal> },
        options: { required: true, type: Object as PropType<Required<Pick<TraceDevtoolsOptions, 'position' | 'width'>>> },
        state: { required: true, type: Object as PropType<DevtoolsState> }
    },
    setup(props) {
        // Bumped by journal events, coalesced per frame so bursts of traces cost a single render.
        const version = ref(0)
        let scheduled = false
        const schedule = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback: () => void) => setTimeout(callback, 16)
        const unsubscribe = props.journal.subscribe(() => {
            if (scheduled) { return }
            scheduled = true
            schedule(() => { scheduled = false; version.value++ })
        })
        onBeforeUnmount(unsubscribe)

        const stores = computed(() => (version.value, summarizeStores(props.journal)))
        const scope = computed(() => {
            const wanted = props.state.scope
            return wanted && stores.value.some(store => store.scope === wanted) ? wanted : stores.value[0]?.scope
        })
        const events = computed(() => (version.value, scope.value ? props.journal.getEvents(scope.value) : []))
        const timeline = computed(() => filterTimeline(buildTimeline(events.value), props.state.filters))

        return () => {
            const { position, width } = props.options
            const { state } = props
            const totalErrors = stores.value.reduce((sum, store) => sum + store.errors, 0)

            if (!state.open) {
                return h('button', {
                    class: ['pps-fab', position, { 'has-errors': totalErrors > 0 }],
                    onClick: () => { state.open = true },
                    title: 'Open the pinia-plugin-subscription devtools'
                }, [bugIcon(), h('span', null, totalErrors ? `Devtools \u00b7 ${totalErrors} \u26a0` : 'Devtools')])
            }

            const current = stores.value.find(store => store.scope === scope.value)
            const filters = state.filters

            return h('aside', { class: ['pps', position], style: { width: `${width}px` } }, [
                h('div', { class: 'pps-header' }, [
                    h('span', { class: 'pps-title' }, 'Devtools \u00b7 store traces'),
                    h('button', {
                        onClick: () => { scope.value && props.journal.clear(scope.value) },
                        title: 'Clear the traces of this store'
                    }, 'Clear'),
                    h('button', { onClick: () => { state.open = false }, title: 'Close' }, '✕')
                ]),
                h('div', { class: 'pps-bar' }, [
                    h('select', {
                        onChange: (event: Event) => { state.scope = (event.target as HTMLSelectElement).value },
                        value: scope.value
                    }, stores.value.map(store => h('option', { selected: store.scope === scope.value, value: store.scope },
                        `${store.scope} (${store.events}${store.errors ? ` · ${store.errors} ⚠` : ''})`))),
                    h('button', { class: { active: state.tab === 'timeline' }, onClick: () => { state.tab = 'timeline' } }, 'Timeline'),
                    h('button', { class: { active: state.tab === 'context' }, onClick: () => { state.tab = 'context' } }, 'Context')
                ]),
                state.tab === 'timeline' ? h('div', { class: 'pps-bar' }, [
                    h('input', {
                        onInput: (event: Event) => { filters.text = (event.target as HTMLInputElement).value },
                        placeholder: 'Filter label, namespace, action…',
                        value: filters.text
                    }),
                    h('select', {
                        onChange: (event: Event) => { filters.side = (event.target as HTMLSelectElement).value as TraceTimelineFilters['side'] },
                        value: filters.side
                    }, ['all', 'client', 'server'].map(side => h('option', { selected: filters.side === side, value: side }, side))),
                    h('select', {
                        onChange: (event: Event) => { filters.level = (event.target as HTMLSelectElement).value as TraceTimelineFilters['level'] },
                        value: filters.level
                    }, ['all', 'error'].map(level => h('option', { selected: filters.level === level, value: level }, level)))
                ]) : null,
                h('div', { class: 'pps-body' }, [
                    current?.dropped ? h('div', { class: 'pps-notice' }, `${current.dropped} older events dropped (size cap)`) : null,
                    !scope.value ? h('div', { class: 'pps-muted' }, 'No store traced yet.') : null,
                    state.tab === 'context' ? renderContext(events.value) : renderTimeline(timeline.value, state)
                ])
            ])
        }
    }
})

function renderContext(events: TraceEvent[]): VNode {
    const context = findContextEvent(events)
    if (!context) { return h('div', { class: 'pps-muted' }, 'No context recorded for this store.') }

    return h('div', null, [
        h('div', { class: 'pps-muted' }, `Recorded ${formatTime(context.timestamp)} (live objects are shown as they were serialized now)`),
        renderValue(undefined, serializedOf(context, buildContextView(context.payload ?? {})))
    ])
}

function renderGroup(group: TraceTimelineGroup, state: DevtoolsState): VNode {
    const open = state.expanded[group.id] === true

    return h('div', { class: 'pps-entry', key: group.id }, [
        h('button', {
            class: ['pps-row', { 'pps-error': group.hasError }],
            onClick: () => { state.expanded[group.id] = !open },
            title: group.groupId
        }, [
            h('span', { class: 'pps-caret' }, open ? '\u25be' : '\u25b8'),
            h('strong', null, group.title),
            h('span', { class: ['pps-badge', group.side] }, group.side),
            h('span', { class: 'pps-muted' }, `${group.count} event${group.count > 1 ? 's' : ''}${group.hasError ? ' \u00b7 error' : ''}`)
        ]),
        open ? h('div', { class: 'pps-children' }, renderEntries(group.items, state)) : null
    ])
}

function renderEntries(entries: TraceTimelineEntry[], state: DevtoolsState): VNode[] {
    return entries.map(entry => entry.kind === 'group'
        ? renderGroup(entry, state)
        : h('div', { class: 'pps-entry', key: entry.id }, [renderEvent(entry.event, state)]))
}

function renderTimeline(entries: TraceTimelineEntry[], state: DevtoolsState): VNode {
    if (!entries.length) { return h('div', { class: 'pps-muted' }, 'No event matches.') }

    return h('div', null, renderEntries(entries, state))
}

export function createDevtoolsState(open: boolean): DevtoolsState {
    return reactive({ expanded: {}, filters: { ...defaultTimelineFilters }, open, tab: 'timeline' }) as DevtoolsState
}
