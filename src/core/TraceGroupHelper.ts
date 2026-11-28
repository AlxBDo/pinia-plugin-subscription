import type { PluginSubscriptionOptions } from "../types/plugin"
import type { TraceReporter } from "../types/core"
import type { TraceEvent, TracePayload } from "../types/trace"

export const defaultDeferredTraceGroupTimeout = 2500

/** Opens/closes trace groups and runs callbacks while tracing their failures. */
export default class TraceGroupHelper {
    private _options: PluginSubscriptionOptions | undefined
    private _reporter: TraceReporter
    private _seq = 0

    constructor(options: PluginSubscriptionOptions | undefined, reporter: TraceReporter) {
        this._options = options
        this._reporter = reporter
    }

    /** Returns a sequence number, unique per plugin instance, used to build group ids. */
    nextSeq(): number {
        return ++this._seq
    }

    start(payload: TracePayload, scope: string, label?: string, emitTrace = true): void {
        const tracerHandler = this._options?.tracerHandler
        if (tracerHandler && (tracerHandler.hasTraceListeners?.() ?? true)) {
            payload = (typeof payload === 'function' ? payload() : (payload ?? {}))
            tracerHandler.startGroup({
                ...payload,
                scope
            } as TraceEvent)
            if (emitTrace) { this._reporter.trace(label ?? 'context', scope, payload) }
        }
    }

    end(payload: TracePayload, scope: string): void {
        const tracerHandler = this._options?.tracerHandler
        if (tracerHandler && (tracerHandler.hasTraceListeners?.() ?? true)) {
            tracerHandler.closeGroup({
                ...(typeof payload === 'function' ? payload() : (payload ?? {})),
                scope
            })
        }
    }

    /** Closes a trace group once all async callbacks are settled (immediately if none is pending). */
    endAfter(pending: (Promise<void> | undefined)[], end: () => void): void {
        const promises = pending.filter((p): p is Promise<void> => !!p)
        if (promises.length) {
            Promise.all(promises).then(end)
        } else {
            end()
        }
    }

    /**
     * Closes a trace group once `pending` settles, or after the configured timeout so a promise
     * that never settles cannot keep buffering the traces of the store scope.
     */
    closeWhenSettled(
        pending: Promise<unknown>,
        closeGroup: () => void,
        storeId: string,
        subscriberName: string
    ): void {
        let closed = false
        const closeOnce = () => {
            if (closed) {
                return
            }
            closed = true
            globalThis.clearTimeout(timer)
            closeGroup()
        }
        const timeout = this._options?.deferredTraceGroupTimeout ?? defaultDeferredTraceGroupTimeout
        const timer = globalThis.setTimeout(() => {
            if (closed) {
                return
            }
            this._reporter.traceError(
                'subscriber:deferred:timeout',
                new Error(`Subscriber "${subscriberName}" hydration still pending after ${timeout}ms`),
                storeId
            )
            closeOnce()
        }, timeout)

        pending.then(closeOnce, closeOnce)
    }

    /**
     * Runs a callback, tracing sync errors and async rejections.
     * @returns a never-rejecting promise when the callback is asynchronous, undefined otherwise.
     */
    runSafely(
        callback: () => unknown,
        errorLabel: string,
        storeId: string,
        extra?: () => Record<string, unknown>
    ): Promise<void> | undefined {
        try {
            const result = callback()
            if (result && typeof (result as Promise<unknown>).then === 'function') {
                return Promise.resolve(result).then(
                    () => undefined,
                    error => this._reporter.traceError(errorLabel, error, storeId, extra)
                )
            }
        } catch (error) {
            this._reporter.traceError(errorLabel, error, storeId, extra)
        }
    }
}
