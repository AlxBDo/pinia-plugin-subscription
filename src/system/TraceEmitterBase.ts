import type { TracePayload, Tracer } from '../types/trace'

/**
 * Base class for objects emitting structured trace events.
 * Subclasses provide `_className` and may override `tracer` to build it lazily.
 */
export default abstract class TraceEmitterBase {
    protected _tracer?: Tracer

    /** Returns the structured trace emitter, if tracing is enabled. */
    get tracer(): Tracer | undefined {
        return this._tracer
    }

    /**
     * Emits a structured trace event.
     * Prefer the factory form for `payload`: it is only resolved when consumed.
     */
    trace(label: string, scope?: string, payload?: TracePayload, namespace?: string): void {
        if (this.tracer) {
            label = this.traceLabelFormatter(label)
            this.tracer.debug(label, namespace ?? label.toLowerCase(), payload, scope)
        }
    }

    /**
     * Emits a structured error event, or reports it with `console.error` when tracing is disabled.
     */
    traceError(label: string, error: unknown, scope?: string, payload?: TracePayload, namespace?: string): void {
        if (this.tracer) {
            label = this.traceLabelFormatter(label)
            this.tracer.error(label, namespace ?? label.toLowerCase(), error, payload, scope)
        } else {
            console.error(error)
        }
    }

    protected traceLabelFormatter(label: string): string {
        return label
    }
}
