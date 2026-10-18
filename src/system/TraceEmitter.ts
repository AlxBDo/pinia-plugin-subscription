import type Tracer from './Tracer'
import type { TracePayload } from '../types/trace'

/**
 * Base class for objects emitting structured trace events.
 * Subclasses provide `_className` and may override `tracer` to build it lazily.
 */
export default abstract class TraceEmitter {
    protected abstract _className: string
    protected _tracer?: Tracer
    private _traceOptions: Record<string, boolean> = {
        /** Indicates whether to add the class name to the namespace for tracing purposes. */
        addClassNameToLabel: true,
    }

    get classNameAddedToTraceNamespace(): boolean {
        return this._traceOptions.addClassNameToLabel === true
    }

    set classNameAddedToTraceNamespace(value: boolean) {
        this._traceOptions.addClassNameToLabel = value
    }

    /** Returns the structured trace emitter, if tracing is enabled. */
    protected get tracer(): Tracer | undefined {
        return this._tracer
    }

    /**
     * Emits a structured trace event.
     * Prefer the factory form for `payload`: it is only resolved when consumed.
     */
    trace(label: string, scope?: string, payload?: TracePayload, namespace?: string): void {
        const tracer = this.tracer
        if (tracer) {
            label = this.traceLabelFormatter(label)
            tracer.debug(label, namespace ?? label.toLowerCase(), payload, scope)
        }
    }

    /**
     * Emits a structured error event, or reports it with `console.error` when tracing is disabled.
     */
    traceError(label: string, error: unknown, scope?: string, payload?: TracePayload, namespace?: string): void {
        const tracer = this.tracer
        if (tracer) {
            label = this.traceLabelFormatter(label)
            tracer.error(label, namespace ?? label.toLowerCase(), error, payload, scope)
        } else {
            console.error(error)
        }
    }

    private traceLabelFormatter(label: string): string {
        return this.classNameAddedToTraceNamespace ? `${this._className}:${label}` : label
    }
}
