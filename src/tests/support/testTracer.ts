import type { TraceEvent, TraceEventMetadata, TraceHandler, TracePayload, Tracer, TracerHandler } from '../../types/trace'

interface TestListener {
    filter: (event: TraceEventMetadata) => boolean
    handler: TraceHandler
}

/**
 * Minimal in-memory tracing package: the plugin only needs a `TracerHandler`,
 * so core tests do not depend on `pinia-plugin-subscription-devtools`.
 */
export function createTestTracerRegistry() {
    let listeners: TestListener[] = []
    const openGroups = new Map<string, string[]>()

    const currentGroupId = (scope?: string) => {
        const stack = scope ? openGroups.get(scope) : undefined
        return stack?.[stack.length - 1]
    }

    function track(action: 'close' | 'open', { groupId, scope }: TraceEvent) {
        if (!groupId || !scope) { return }

        const stack = openGroups.get(scope) ?? []
        if (action === 'open') {
            openGroups.set(scope, [...stack, groupId])
            return
        }

        const index = stack.lastIndexOf(groupId)
        if (index >= 0) { stack.splice(index, 1) }
        if (!stack.length) { openGroups.delete(scope) }
    }

    function createTracer(source: string): Tracer {
        const emit = (level: TraceEvent['level'], label: string, namespace: string, payload?: TracePayload, scope?: string, error?: unknown) => {
            const metadata: TraceEventMetadata = { label, level, namespace, scope: scope ?? tracer.scope, source }
            const matched = listeners.filter(listener => listener.filter(metadata))
            if (!matched.length) { return }

            const resolved = typeof payload === 'function' ? payload() : payload
            const { actionId, groupId: payloadGroupId, ...rest } = resolved ?? {}
            const groupId = typeof payloadGroupId === 'string' ? payloadGroupId : currentGroupId(metadata.scope)
            const lifted = typeof actionId === 'string' || typeof payloadGroupId === 'string'
            const event: TraceEvent = {
                ...metadata,
                ...(typeof actionId === 'string' && { actionId }),
                ...(groupId !== undefined && { groupId }),
                ...(error !== undefined && { error }),
                ...(resolved !== undefined && { payload: lifted ? rest : resolved }),
                timestamp: Date.now()
            }

            matched.forEach(listener => listener.handler(event))
        }

        const tracer: Tracer = {
            debug: (label, namespace, payload, scope) => emit('debug', label, namespace, payload, scope),
            error: (label, namespace, error, payload, scope) => emit('error', label, namespace, payload, scope, error),
            scope: undefined,
            source
        }

        return tracer
    }

    const tracerHandler: TracerHandler = {
        closeGroup: event => track('close', event),
        createTracer,
        hasTraceListeners: () => listeners.length > 0,
        startGroup: event => track('open', event)
    }

    return {
        addListener(listener: Partial<TestListener> & { handler: TraceHandler }) {
            const registered: TestListener = { filter: () => true, ...listener }
            listeners.push(registered)
            return () => { listeners = listeners.filter(item => item !== registered) }
        },
        clearTraceListeners() { listeners = [] },
        tracerHandler
    }
}
