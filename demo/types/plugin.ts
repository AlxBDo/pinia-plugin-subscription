import type { StoreOptions } from "pinia-plugin-subscription"

export interface DemoPluginClassOptions extends StoreOptions {
    active: boolean
}

export type HydrationEnvironment = 'client' | 'server'

export interface HydrationStep {
    at: string
    environment: HydrationEnvironment
    label: string
}

export interface VisitorServerData {
    locale: string
    pathname: string
    renderedAt: string
}

export interface VisitorBrowserData {
    colorScheme: 'dark' | 'light'
    timezone: string
    viewport: string
}

export interface VisitorState {
    browser: VisitorBrowserData | null
    server: VisitorServerData | null
    steps: HydrationStep[]
}

export interface DemoRequestContext {
    acceptLanguage?: string
}