import { mountTraceDevtools } from '../panel/mount'
import { isProductionEnvironment } from '../utils/environment'
import { createTracerRegistry } from './trace-registry'

import type { CreateTraceDevtoolsOptions, TraceDevtools } from '../types/devtools'
import type { TraceRegistry } from '../types/trace'

function importServerSnapshot(registry: TraceRegistry, serverSnapshotId: string | false) {
    if (serverSnapshotId === false || !registry.journal) { return }

    const snapshotElement = document.getElementById(serverSnapshotId)
    if (snapshotElement instanceof HTMLScriptElement && snapshotElement.type === 'application/json') {
        try {
            registry.journal.import(JSON.parse(snapshotElement.textContent ?? 'null'))
        } catch (error) {
            console.error(`Failed to import SSR trace snapshot (element id: ${serverSnapshotId}).`, error)
        }
    }
}

/**
 * Creates a journal-backed trace registry with redacted payloads and, in a development browser,
 * mounts the in-page panel. Pass `registry.tracerHandler` to `createPlugin()`.
 *
 * An SSR journal snapshot found in a `<script type="application/json" id="pinia-traces">` element is imported.
 * Nothing is mounted on the server or in production builds.
 */
export function createTraceDevtools({ serverSnapshotId = 'pinia-traces', ...panelOptions }: CreateTraceDevtoolsOptions = {}): TraceDevtools {
    const registry = createTracerRegistry({ journal: true, redact: true })

    if (typeof window === 'undefined' || isProductionEnvironment()) {
        return { registry }
    }

    importServerSnapshot(registry, serverSnapshotId)

    return { handle: mountTraceDevtools(registry, panelOptions), registry }
}
