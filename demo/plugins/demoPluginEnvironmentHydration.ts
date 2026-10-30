import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import VisitorEnvironmentStore from '../core/VisitorEnvironmentStore'

import type { VisitorBrowserData, VisitorServerData } from '../types/plugin'

const createVisitorStore = VisitorEnvironmentStore.customizeStore.bind(VisitorEnvironmentStore)

// Runs on the server only: the plugin skips it in the browser.
class ServerVisitorSubscriber extends PluginSubscriber<VisitorEnvironmentStore> {
    private _loadData: () => Promise<VisitorServerData>
    private _rejectReady!: (error: unknown) => void
    private _resolveReady!: () => void

    readonly ready: Promise<void>

    constructor(loadData: () => Promise<VisitorServerData>) {
        super('demo-plugin-server-visitor', createVisitorStore)
        this._loadData = loadData
        this.execution = { environment: 'server' }
        this.ready = new Promise<void>((resolve, reject) => {
            this._resolveReady = resolve
            this._rejectReady = reject
        })
    }

    override async hydrate(): Promise<void> {
        try {
            await this.storeInstance?.hydrateFromServer(this._loadData)
            this._resolveReady()
        } catch (error) {
            this._rejectReady(error)
            throw error
        }
    }
}

// Runs in the browser only, once the page is hydrated: the plugin skips it on the server.
class BrowserVisitorSubscriber extends PluginSubscriber<VisitorEnvironmentStore> {
    private _readBrowserData: () => VisitorBrowserData

    constructor(readBrowserData: () => VisitorBrowserData) {
        super('demo-plugin-browser-visitor', createVisitorStore)
        this._readBrowserData = readBrowserData
        this.execution = { environment: 'client', hydration: 'defer' }
    }

    override hydrate(): void {
        this.storeInstance?.hydrateFromBrowser(this._readBrowserData)
    }
}

export function readBrowserVisitorData(): VisitorBrowserData {
    return {
        colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: `${window.innerWidth} × ${window.innerHeight}`
    }
}

export function createServerVisitorSubscriber(loadData: () => Promise<VisitorServerData>) {
    const subscriber = new ServerVisitorSubscriber(loadData)

    return { ready: subscriber.ready, subscriber }
}

export function createBrowserVisitorSubscriber(readBrowserData: () => VisitorBrowserData = readBrowserVisitorData) {
    return new BrowserVisitorSubscriber(readBrowserData)
}
