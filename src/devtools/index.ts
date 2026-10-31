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
    const root = host.attachShadow({ mode: 'open' })
    attachStyles(root)
    const mountPoint = document.createElement('div')
    root.appendChild(mountPoint)
    ;(container ?? document.body).appendChild(host)

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
            app.unmount()
            host.remove()
        }
    }
}

export type { TraceDevtoolsHandle, TraceDevtoolsOptions } from '../types/devtools'
