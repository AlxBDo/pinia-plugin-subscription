import { describe, expectTypeOf, it } from 'vitest'
import PluginSubscriber from '../core/PluginSubscriber'
import Store from '../core/Store'

class TraceStore extends Store {
    report(): void {
        this.trace('test')
        this.traceError('test', new Error('failure'))
        this.traceOptions.prefixLabelWithName = false
    }
}

describe('Store tracing visibility', () => {
    it('preserves the wrapper type when looking up a subscriber store instance', () => {
        expectTypeOf<ReturnType<PluginSubscriber<TraceStore>['getStoreInstance']>>()
            .toEqualTypeOf<TraceStore | undefined>()
    })

    it('keeps trace helpers protected while exposing the tracer', () => {
        const store = null as unknown as TraceStore
        store.tracer
        // @ts-expect-error Trace helpers are protected and only available in subclasses.
        store.trace('test')
        // @ts-expect-error Error tracing is protected and only available in subclasses.
        store.traceError('test', new Error('failure'))
        // @ts-expect-error Trace formatting is configured by subclasses.
        store.traceOptions.prefixLabelWithName = false
    })
})
