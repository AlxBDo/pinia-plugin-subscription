import { createApp } from 'vue'
import { TraceDevtoolsPanel, createDevtoolsState } from './components'
import { devtoolsStyles } from './styles'

import type { TraceDevtoolsHandle, TraceDevtoolsOptions } from '../types/devtools'
import type { TraceRegistry } from '../types/trace'

const hostId = 'pinia-plugin-subscription-devtools'
const noopHandle: TraceDevtoolsHandle = { close() { }, open() { }, toggle() { }, unmount() { } }

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split('+').map(part => part.trim())
    const key = parts[parts.length - 1]
    const modifiers = new Set(parts.slice(0, -1))

    return event.key.toLowerCase() === key
        && event.ctrlKey === modifiers.has('ctrl')
        && event.shiftKey === modifiers.has('shift')
        && event.altKey === modifiers.has('alt')
        && event.metaKey === modifiers.has('meta')
}

function attachStyles(root: ShadowRoot): void {
    if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in root) {
        try {
            const sheet = new CSSStyleSheet()
            sheet.replaceSync(devtoolsStyles)
            root.adoptedStyleSheets = [sheet]
            return
        } catch {
            // falls back to a <style> element
        }
    }

    const style = document.createElement('style')
    style.textContent = devtoolsStyles
    root.appendChild(style)
}

/**
 * Keeps the aside clear of the page scrollbar (classic or overlay), which is otherwise painted over the aside one.
 * The gutter is exposed as `--pps-gutter` and applied to the aside and the button.
 */
function watchPageScrollbar(host: HTMLElement): () => void {
    const root = document.documentElement
    const update = () => {
        const scrollable = root.scrollHeight > window.innerHeight
        const classic = window.innerWidth - root.clientWidth
        host.style.setProperty('--pps-gutter', `${scrollable ? Math.max(classic, 14) : 0}px`)
    }
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : undefined
    observer?.observe(root)

    return () => {
        window.removeEventListener('resize', update)
        observer?.disconnect()
    }
}

/**
 * Puts the host in the browser top layer: its fixed children are then laid out against the viewport,
 * even when an ancestor of the page has a transform / filter (which would stretch the aside to the page height
 * and leave the scroll to the page).
 */
function promoteToTopLayer(host: HTMLElement): void {
    if (typeof host.showPopover !== 'function') { return }

    host.popover = 'manual'
    host.style.cssText = 'position:fixed;inset:0 auto auto 0;width:0;height:0;margin:0;padding:0;border:0;overflow:visible;background:transparent;'
    try { host.showPopover() } catch { /* not connected: keep the regular layout */ }
}

/**
 * Mounts the trace panel in the page: an aside, isolated in a Shadow DOM, reading the registry journal.
 * Meant for development: load it with a dynamic import and keep it out of production builds.
 * It does nothing outside a browser, or when the registry has no journal (`createTracerRegistry({ journal: true })`).
 */
export function mountTraceDevtools(
    registry: Pick<TraceRegistry, 'journal'>,
    { container, open = false, position = 'right', shortcut = 'Alt+Shift+P', width = 480 }: TraceDevtoolsOptions = {}
): TraceDevtoolsHandle {
    if (typeof document === 'undefined') { return noopHandle }

    const journal = registry.journal
    if (!journal) {
        console.warn('mountTraceDevtools: enable the journal with createTracerRegistry({ journal: true }).')
        return noopHandle
    }

    document.getElementById(hostId)?.remove()
    const host = document.createElement('div')
    host.id = hostId
    // The wheel over the aside always scrolls the aside body, never the page behind it.
    host.addEventListener('wheel', event => {
        const aside = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('pps'))
        const body = aside?.querySelector<HTMLElement>('.pps-body')
        if (!body || event.ctrlKey) { return }

        event.preventDefault()
        event.stopPropagation()
        body.scrollTop += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    }, { passive: false })
    host.addEventListener('touchmove', event => event.stopPropagation(), { passive: true })
    const stopWatchingScrollbar = watchPageScrollbar(host)
    const root = host.attachShadow({ mode: 'open' })
    attachStyles(root)
    const mountPoint = document.createElement('div')
    root.appendChild(mountPoint)
    ;(container ?? document.body).appendChild(host)
    promoteToTopLayer(host)

    const state = createDevtoolsState(open)
    const app = createApp(TraceDevtoolsPanel, { journal, options: { position, width }, state })
    app.mount(mountPoint)

    const onKeydown = (event: KeyboardEvent) => {
        if (shortcut && matchesShortcut(event, shortcut)) {
            event.preventDefault()
            state.open = !state.open
        }
    }
    document.addEventListener('keydown', onKeydown)

    return {
        close() { state.open = false },
        open() { state.open = true },
        toggle() { state.open = !state.open },
        unmount() {
            document.removeEventListener('keydown', onKeydown)
            stopWatchingScrollbar()
            app.unmount()
            host.remove()
        }
    }
}

export type { TraceDevtoolsHandle, TraceDevtoolsOptions } from '../types/devtools'
