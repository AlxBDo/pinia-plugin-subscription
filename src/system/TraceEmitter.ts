import TraceEmitterBase from './TraceEmitterBase'

/**
 * Base class for objects emitting structured trace events.
 * Subclasses provide `_className` and may override `tracer` to build it lazily.
 */
export default abstract class TraceEmitter extends TraceEmitterBase {
    protected abstract _className: string
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

    protected override traceLabelFormatter(label: string): string {
        return this.classNameAddedToTraceNamespace ? `${this._className}:${label}` : label
    }
}
