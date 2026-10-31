import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, type PropType, type VNode } from 'vue'
import { toSerializable } from '../utils/toSerializable'
import { buildTimeline, defaultTimelineFilters, filterTimeline, findContextEvent, summarizeStores } from './model'

import type { TraceJournal, TraceEvent } from '../types/trace'
import type { TraceDevtoolsOptions, TraceTimelineFilters } from '../types/devtools'

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

function renderEvent(event: TraceEvent, state: DevtoolsState): VNode {
    const id = `${event.side}:${event.seq}`
    const expanded = !!state.expanded[id]
    const detail = { error: event.error, payload: event.payload }

    return h('div', null, [
        h('button', {
            class: ['pps-row', { 'pps-error': event.level === 'error' }],
            onClick: () => { state.expanded[id] = !expanded }
        }, [
            h('span', { class: 'pps-seq' }, `#${event.seq ?? '?'}`),
            h('span', { class: ['pps-badge', event.side ?? 'client'] }, event.side ?? 'client'),
            h('span', null, event.label),
            h('span', { class: 'pps-muted' }, formatTime(event.timestamp))
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
                    title: 'Open pinia-plugin-subscription traces'
                }, totalErrors ? `PPS · ${totalErrors} ⚠` : 'PPS')
            }

            const current = stores.value.find(store => store.scope === scope.value)
            const filters = state.filters

            return h('aside', { class: ['pps', position], style: { width: `${width}px` } }, [
                h('div', { class: 'pps-header' }, [
                    h('span', { class: 'pps-title' }, 'Pinia subscription traces'),
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
        renderValue(undefined, serializedOf(context, context.payload ?? {}))
    ])
}

function renderTimeline(entries: ReturnType<typeof buildTimeline>, state: DevtoolsState): VNode {
    if (!entries.length) { return h('div', { class: 'pps-muted' }, 'No event matches.') }

    return h('div', null, entries.map(entry => {
        if (!entry.actionId) { return h('div', { class: 'pps-entry', key: entry.id }, [renderEvent(entry.events[0]!, state)]) }

        const open = state.expanded[entry.id] !== false
        return h('div', { class: 'pps-entry', key: entry.id }, [
            h('button', {
                class: ['pps-row', { 'pps-error': entry.hasError }],
                onClick: () => { state.expanded[entry.id] = !open }
            }, [
                h('span', { class: 'pps-seq' }, `#${entry.seq}`),
                h('strong', null, entry.actionId),
                h('span', { class: 'pps-muted' }, `${entry.events.length} events${entry.hasError ? ' · error' : ''}`)
            ]),
            open ? h('div', { class: 'pps-children' }, entry.events.map(event => renderEvent(event, state))) : null
        ])
    }))
}

export function createDevtoolsState(open: boolean): DevtoolsState {
    return reactive({ expanded: {}, filters: { ...defaultTimelineFilters }, open, tab: 'timeline' }) as DevtoolsState
}
