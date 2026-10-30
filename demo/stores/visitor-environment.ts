import { ref } from 'vue'
import { defineAStore } from 'pinia-plugin-subscription'

import type { HydrationStep, VisitorBrowserData, VisitorServerData } from '../types/plugin'

// A single store: the server subscriber fills `server`, the browser subscriber fills `browser`.
export const useVisitorEnvironmentStore = defineAStore(
    'visitorEnvironmentStore',
    () => {
        const browser = ref<VisitorBrowserData | null>(null)
        const server = ref<VisitorServerData | null>(null)
        const steps = ref<HydrationStep[]>([])

        return { browser, server, steps }
    },
    { demoEnvironmentHydration: true }
)
