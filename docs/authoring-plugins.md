# Plugin authoring guide

Guide for **plugin authors** building their own pinia plugin on top of
`pinia-plugin-subscription`.

If you only want to **use** compatible plugins in an application, read
[Using compatible plugins](using-plugins.md) instead.

> **Documentation convention:** JavaScript examples come first and are
> complete and runnable as-is. TypeScript versions follow, adding type
> annotations and generics. Types are always optional at runtime — they only
> add autocompletion and compile-time checks.

## Mental model

- A **subscriber** is invoked by the central `PluginSubscription` engine
  each time pinia registers a store.
- A subscriber can extend the store, register callbacks (mutation
  subscriptions and action subscriptions), and declare an
  execution policy for SSR.
- `createPlugin([...subscribers])` aggregates subscribers into a single
  pinia plugin.

Two authoring styles are available:

1. **Plain object** implementing `PluginSubscriberInterface` — lightweight,
   no classes.
2. **`PluginSubscriber` abstract class + `Store` subclass** — recommended
   for richer plugins: the `Store` subclass wraps the pinia store with
   helpers (state extension, subscriptions, structured tracing).

## Your first subscriber: a plain object

### JavaScript

```js
export const myStoreSubscriber = {
  name: 'my-plugin',

  invoke: (context) => {
    // context contains `store`, `options`, `pinia`
    console.log('store registered', context.store.$id)

    return true
  }
}
```

### TypeScript

```ts
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/types'

export const myStoreSubscriber: PluginSubscriberInterface = {
  name: 'my-plugin',

  invoke: (context) => {
    console.log('store registered', context.store.$id)

    return true
  }
}
```

### With the `createPluginSubscriber()` factory

`createPluginSubscriber(name, invoke, optionalProps?)` builds the same plain object with `name` and `invoke` as positional arguments. `optionalProps` accepts any other `PluginSubscriberInterface` member (`afterHydration`, `execution`, `hydrate`, `hydrationScheduler`, `storeOnActionSubscription`, `storeMutationSubscription`, `subscriptions`, `tracer`).

```ts
import { createPluginSubscriber } from 'pinia-plugin-subscription/helpers'

export const myStoreSubscriber = createPluginSubscriber(
  'my-plugin',
  (context, pluginOptions) => {
    console.log('store registered', context.store.$id)
    const tracer = pluginOptions?.createTracer?.('my-plugin')
    tracer?.debug('Store registered', 'my-plugin:registered', { storeId: context.store.$id })

    return true
  }
)
```

The host app registers subscribers through `createPlugin()`:

```js
import { createPlugin } from 'pinia-plugin-subscription'

pinia.use(createPlugin([myStoreSubscriber]))
```

## `PluginSubscriberInterface` reference

| Member | Type | Description |
| --- | --- | --- |
| `name` (required) | `string` | Unique plugin name. |
| `invoke` (required) | `(context: PiniaPluginContext) => boolean` | Called when a store is registered. Return `false` to skip the store. |
| `execution` | `PluginExecutionOptions` | Where/when the subscriber runs — see [Execution policy & SSR](#execution-policy--ssr). |
| `hydrationScheduler` | `(run: () => void) => void` | Custom scheduler used when hydration is deferred. |
| `hydrate` | `(context) => void \| Promise<void>` | SSR-safe initialization hook; guaranteed to run before `afterHydration`. |
| `afterHydration` | `(context) => void \| Promise<void>` | Post-hydration lifecycle hook. |
| `storeOnActionSubscription` | `(context: PiniaPluginContext) => { store, callback }` | Receives the Pinia plugin context and returns an action subscription forwarded to the store's `$onAction`. Multiple subscribers can target the same store through a single `$onAction` hook; subscriptions are attached after deferred hydration and removed on store disposal. |
| `storeMutationSubscription` | `() => { store, callback }` | Returns a mutation subscription forwarded to pinia's `$subscribe`. Several subscribers can target the same store through a single `$subscribe` hook; callback errors are isolated and traced, and the hook is unsubscribed on store disposal. |
| `subscriptions` | `Record<string, PluginSubscription>` | Plugin-specific subscription functions exposed to other plugins. |
| `tracer` | `Tracer \| undefined` | Optional tracer. `PluginSubscriber` instances receive one from `createPlugin()` when tracing is configured. |

All members except `name` and `invoke` are optional.

## The `PluginSubscriber` abstract class

For class-based plugins, extend `PluginSubscriber<Instance>`. The subscriber
creates the instance through a factory — conventionally
`MyPlugin.customizeStore.bind(MyPlugin)`.

### Type parameter (TypeScript only)

| Generic | Constraint | Role |
| --- | --- | --- |
| `Instance` | `extends Store` | The `Store` subclass your plugin creates for each registered store. |

TypeScript subclasses must provide the `Store` subclass as the generic
parameter. This types `getStoreInstance(store)`, so overridden hooks (`hydrate()`,
`afterHydration()`, `pluginCreated`) get full autocompletion and compile-time
checks when they call your plugin's custom methods.

Constructor:

```ts
constructor(createInstance: CreateInstance)
```

Each concrete subscriber must define a unique protected `_name` field. Its
value is used for subscriber identity, execution options, and tracing.

| Member | Kind | Description |
| --- | --- | --- |
| `execution` | public field | Execution policy (see below). |
| `hydrationScheduler` | public field | Custom scheduler used when hydration is deferred. |
| `pluginCreated` | protected field | Optional hook called with the pinia store after a successful `invoke`. |
| `pluginOptions` | getter/setter | Extra options merged into the options passed to your `Store` factory. |
| `getStoreInstance(store)` | method | Returns the `Store` subclass instance for the specified Pinia store, or `undefined` if none was created. |
| `tracer` | getter | Tracer created for this subscriber during `invoke()`, or `undefined` when tracing is not configured. The same tracer is provided to the `Store` factory through its `createTracer()` option. |
| `hydrate()` / `afterHydration()` | methods | Lifecycle stubs to override for SSR-safe initialization. |
| `invoke()` | method | Implemented for you: creates the instance, wires `subscriptions`, `storeSubscribe` and `onAction`, then calls `pluginCreated`. Returns `false` when the factory creates no instance. |

Use the store passed to each hook to retrieve its wrapper, including after an
`await`. Wrappers are held in a `WeakMap` keyed by store identity, not `$id`;
disposing a store does not itself cancel an already-running hydration hook.

### JavaScript

```js
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'

class MyPlugin extends Store {
  constructor(store, options) {
    super(store, options)
    this.doSomething()
  }

  doSomething() {
    this.trace('my-plugin:doSomething', this.store.$id, () => ({ storeId: this.store.$id }))
  }
}

class MyPluginSubscriber extends PluginSubscriber {
  _name = 'my-plugin'

  constructor() {
    super((store, options) => new MyPlugin(store, options))
  }
}

export const myStoreSubscriber = new MyPluginSubscriber()
```

### TypeScript

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'
import type { Store as PiniaStore } from 'pinia'
import type { StoreClassConstructorParams } from 'pinia-plugin-subscription/types'

class MyPlugin extends Store {
  protected override _name: string = 'MyPlugin'
  protected static override _requiredKeys?: string[] = ['my-plugin-option']

  constructor(store: PiniaStore, options: StoreClassConstructorParams) {
    super(store, options)
    this.doSomething()
  }

  doSomething(): void {
    this.trace('my-plugin:doSomething', this.store.$id, () => ({ storeId: this.store.$id }))
  }
}

class MyPluginSubscriber extends PluginSubscriber<MyPlugin> {
  protected _name = 'my-plugin'

  constructor() {
    super(MyPlugin.customizeStore.bind(MyPlugin))
  }
}

export const myStoreSubscriber = new MyPluginSubscriber()
```

> **Important contract:** `Store.customizeStore()` only creates an instance
> when the store defines `storeOptions` **and** every key listed in the
> static `_requiredKeys` is present in those options. When no instance is
> created, `invoke()` returns `false` and the store is skipped by your
> plugin. Declare `_requiredKeys = []` to accept every store that defines
> `storeOptions`.

## The `Store` base class

`Store` wraps a pinia store (`PiniaStore`) and exposes:

**Properties:** `options`, `state`, `store`.

**Methods:**

| Method | Description |
| --- | --- |
| `addToState(name, value?)` | Adds a property to the store state; exposed as a `Ref` for setup-style stores. |
| `addSubscription(pluginName, subscription, options?)` | Registers a plugin-specific subscription function. |
| `getSubscriptions()` | Returns registered subscriptions (`undefined` when empty). |
| `getOption(optionName)` | Reads one key from the store's `StoreOptions`. |
| `getStatePropertyValue(propertyName)` | Reads a state property, unwrapping refs. |
| `storeSubscribe` (getter/setter) | Factory for pinia's `$subscribe` (`{ store, callback }`). |
| `onAction` (getter/setter) | Factory for pinia's `$onAction` (`{ store, callback }`). |
| `static customizeStore(store, options)` | Recommended factory; guarded by `_requiredKeys` (see above). |
| `trace(label, scope?, payload?, namespace?)` | Protected method that emits a structured trace event. The tracer's default scope is the wrapped store ID. |
| `traceError(label, error, scope?, payload?, namespace?)` | Protected method that emits an error event; without a tracer, reports it with `console.error`. |
| `traceOptions.prefixLabelWithName` | Protected option controlling whether `_name` is prefixed to trace labels; enabled by default for `Store`. |
| `addEventSubscription(eventName, consumer, options?)` | Protected method for registering a callback with the shared event registry. |
| `stateHas(property)` / `storeHas(property)` | Safe `hasOwnProperty` checks on state / store. |
| `getValue(value)` | Unwraps a ref or returns the value as-is. |
| `isOptionApi()` | Whether the store uses the options API. |
| `hydrate()` / `afterHydration()` | Lifecycle stubs for SSR-safe initialization. |

## Execution policy & SSR

The source of truth for hydration policy stays on the subscriber itself.
For example, a client-only plugin declares its execution directly:

### JavaScript

```js
import { nextTick } from 'vue'

export const persistedStateSubscriber = {
  name: 'persisted-state',
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrationScheduler: (run) => {
    nextTick(() => run())
  },
  invoke: (context) => {
    // ...
    return true
  }
}
```

### TypeScript

```ts
import { nextTick } from 'vue'
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/types'

export const persistedStateSubscriber: PluginSubscriberInterface = {
  name: 'persisted-state',
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrationScheduler: (run) => {
    nextTick(() => run())
  },
  invoke: (context) => {
    // ...
    return true
  }
}
```

Available execution options (`PluginExecutionOptions`):

- `environment: 'both' | 'client' | 'server'` — controls where the
  subscriber is allowed to run.
- `hydration: 'immediate' | 'defer'` — on the client, `defer` schedules
  execution after hydration.
- `order: number` — subscribers with lower values run first. The default is
  `9`; subscribers with the same value keep their declaration order. Use a
  lower value when a subscriber must initialize before the default group (for
  example, `StateSnapshotsSubscriber` uses `0`).
- `hydrationScheduler` can be provided either on a subscriber or via
  `createPlugin()` to override the execution timing when needed.

The class-based equivalent sets the same policy in the constructor and
overrides the lifecycle hooks:

```ts
import { nextTick } from 'vue'
import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import type { PiniaPluginContext } from 'pinia'

class ExtendingStoreSubscriber extends PluginSubscriber<StoreExtension> {
  protected _name = 'extendsPiniaStore'

  constructor() {
    super(StoreExtension.customizeStore.bind(StoreExtension))

    // Controls when this subscriber may run and whether it should wait
    // for hydration on the client.
    this.execution = {
      environment: 'client',
      hydration: 'defer',
    }

    // Optional framework-specific scheduler for deferred execution.
    this.hydrationScheduler = (run) => {
      nextTick(() => run())
    }
  }

  override hydrate(context: PiniaPluginContext) {
    if (typeof window === 'undefined') {
      return
    }

    // Safe browser-only initialization, only called when the policy allows it.
    return this.getStoreInstance(context.store)?.hydrate?.()
  }
}
```

### SSR / Nuxt best practices

`pinia-plugin-subscription` is SSR-safe by design, but the runtime policy
still needs to match the actual app lifecycle.

Use `hydration: 'defer'` when the subscriber depends on browser-only APIs,
client-side cookies, `localStorage`, DOM access, or a hydrated app state
that must exist only after the app is mounted.

Use `runtimeEnvironment: 'server'` (on `createPlugin()`) or
`execution.environment: 'server'` when a subscriber is only valid during
server-side rendering or should not touch browser-only objects:

```js
pinia.use(createPlugin([serverOnlySubscriber], {
  runtimeEnvironment: 'server'
}))
```

Avoid browser-only code in stores during build-time SSR. In practice:

- do not access `window`, `document`, `localStorage`, or `matchMedia` at
  module scope or during store setup when the code may run on the server;
- keep browser-specific bootstrap in `hydrate()` or `afterHydration()`;
- prefer environment-aware guards such as `typeof window !== 'undefined'`;
- avoid network access or hydration reads before the client is ready,
  unless the code is explicitly intended to run on both environments.

A safe pattern:

```js
const mySubscriber = {
  name: 'safe-browser-access',
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrate: (context) => {
    // safe browser access here, after hydration is allowed
    const saved = localStorage.getItem('demo')
    if (saved) {
      context.store.$patch({ value: JSON.parse(saved) })
    }
  },
  invoke: () => true,
}
```

This keeps the server render deterministic and prevents browser-only
initialization from crashing Nuxt or SSR builds.

### Emitting trace events

Use the protected `trace()` and `traceError()` methods from a `Store` subclass
to emit structured events. The first argument is a human-readable label; by
default the store's `_name` is prefixed to it and the normalized label becomes
the namespace. Pass an explicit `namespace` argument to control the namespace,
or set `this.traceOptions.prefixLabelWithName = false` in the subclass to omit
the prefix. Prefer a payload factory so data is not built unless a listener
consumes the event:

```ts
class CartStore extends Store {
  reportItems(): void {
    this.trace(
      'cart:items',
      this.store.$id,
      () => ({ items: this.state.items }),
      'cart:items'
    )
  }
}
```

The plugin only emits events: it provides the `Tracer` and `TracerHandler`
types (from `pinia-plugin-subscription/types`) and ignores tracing when no
`tracerHandler` is configured. Consuming events is the job of the separate
`pinia-plugin-subscription-devtools` package, which provides
`createTracerRegistry()`. Register event criteria with `addListener()` (with
your own `handler`) and pass the registry's `tracerHandler` through
`createPlugin()` options to consume plugin and store events.
Criteria target event metadata and support `equals`, `contains`, `startsWith`
and `endsWith` comparisons. See the
[Tracing documentation](../packages/devtools/docs/tracing.md) for filtering,
redaction, production safety and error reporting. To test your plugin's
traces, install it as a development dependency, or provide a minimal
`TracerHandler` of your own.

## Typing per-store options: `StoreOptionsExtensions` (TypeScript)

This package is the only one allowed to augment pinia's
`DefineStoreOptionsBase`. A subscriber plugin must **not** redeclare it:
merging `storeOptions` with a different (even compatible) type raises
`TS2717` in consumer code.

Instead, per-store plugin options are centralized behind the
`StoreOptionsExtensions` interface. Augment it through interface merging to
add your own typed keys:

```ts
// my-subscriber-plugin/types.d.ts (shipped with your plugin)
declare module 'pinia-plugin-subscription/types' {
  interface StoreOptionsExtensions {
    myPluginOption?: string
  }
}
```

The keys merge into `StoreOptions`, so store authors get type-checking
directly in the store definition:

```ts
export const useMyStore = defineAStore('myStore', () => { /* ... */ }, {
  rollbackAfterFailure: { save: 'all' },  // provided by pinia-plugin-state-snapshots
  myPluginOption: 'value',                // typed via your augmentation
})
```

Guidelines:

- Always declare **optional** keys with names specific enough to avoid
  collisions (prefer `myPluginOption` over `options`).
- At runtime, merged options are delivered to your subscriber's
  `invoke(context)` through `context.options.storeOptions` — no
  extra wiring needed.
- Never redeclare `DefineStoreOptionsBase` or `PiniaCustomProperties`; only
  this package owns those augmentations.

## API Reference

### Import subpaths

For helper-only imports, the package exposes an additive subpath kept separate from the default library API:

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'
```

For type-only imports, prefer the dedicated public types entry:

```ts
import type { PluginSubscriptionOptions } from 'pinia-plugin-subscription/types'
```

### `createPlugin(subscribers: PluginSubscriber[], options?: PluginSubscriptionOptions): PiniaPlugin`

Creates and returns a Pinia plugin from the provided `subscribers`. Each
subscriber is invoked when a store is registered. The optional `options`
configure execution and hydration defaults (`execution` and
`hydrationScheduler`), per-subscriber execution (`subscriberExecution`),
runtime environment, store behavior and tracing.

### `createPluginSubscriber(name: string, invoke: PluginSubscriberInvoke, optionalProps?: Omit<PluginSubscriber, 'name' | 'invoke'>): PluginSubscriber`

Factory returning a plain-object subscriber `{ name, invoke, ...optionalProps }`. Exported from `pinia-plugin-subscription/helpers`.

### Store event registration

`PluginSubscriberWithoutInstance` has been removed. Use a plain-object
subscriber or extend `PluginSubscriber` with a `Store` wrapper instead.
`createPlugin()` passes a shared event registry to the subscriber and its
`Store`. A `Store` subclass can register callbacks with the protected
`addEventSubscription(eventName, consumer, options?)` method. Its subscriptions
default to the store's `$id` as their scope and are restricted to its Pinia
store instance, even when another instance has the same `$id`. The optional
`scope`, `source`, `instanceId`, and `payload` fields filter events by equality
when truthy; a `Store` always sets `instanceId` to its own instance. Concrete
subscribers must define a unique protected `_name`.
`Store.customizeStore()` initializes the instance and registers its disposal
hook; a custom factory that only calls the constructor does not perform those
steps. When creating a `Store` outside this plugin flow, provide an
`eventsRegistry` in its options to register event callbacks.

The consumer receives an event with `name`, `scope` (the store's `$id`),
`instanceId`, `source`, and an optional lazy `payload()` function. The action
events use these payloads:

| Event | Payload |
| --- | --- |
| `STORE_EVENTS.ACTION_BEFORE` | `{ action, args, invocationKey }` before the action runs. |
| `STORE_EVENTS.ACTION_AFTER` | `{ action, result, invocationKey }` after a successful action. |
| `STORE_EVENTS.ACTION_ON_ERROR` | `{ action, error, invocationKey }` when an action fails. |
| `STORE_EVENTS.ACTION_ERROR` | `{ action, error, invocationKey }` if processing action subscriptions or registering outcome callbacks fails. |

When the store has an event subscriber, `invocationKey` is a symbol correlating
one action invocation across its events. It may be `undefined` otherwise.
Action events can be received without a `storeOnActionSubscription`; outcome
events are not emitted after store disposal.
Consumers run synchronously, but returned promises are not awaited; thrown
errors and rejections are reported to `console.error`.

```ts
import { Store, STORE_EVENTS } from 'pinia-plugin-subscription/helpers'

class ActionObserver extends Store {
  protected static override _requiredKeysValidation: false = false

  protected override init(): void {
    this.addEventSubscription(STORE_EVENTS.ACTION_BEFORE, event => {
      const payload = event.payload?.()
      if (payload) {
        console.log(payload.action, payload.args, payload.invocationKey)
      }
    })
  }
}
```

As with other `Store` subclasses, install it using `customizeStore()` and
provide `storeOptions` in the store's options.

### Migrating subscribers from `main`

- Class-based subscribers define `_name` and pass only the store factory to
  `super()`, instead of passing the name and factory.
- `invoke(context, createTracer)` now receives
  `invoke(context, { createTracer, eventsRegistry })`; update custom `invoke`
  implementations that use its second argument.
- `resetStoreCallback` is no longer collected by the orchestrator. Install
  `pinia-plugin-state-snapshots` and register callbacks with `$onResetStore()`
  when its reset wrapper is enabled. Those callbacks now run **after** state
  restoration, rather than before it.
- Replace `subscriber.storeInstance` with
  `subscriber.getStoreInstance(context.store)` in lifecycle hooks.

`createPlugin()` accepts hydration options directly. Set shared execution and
scheduling defaults for its subscribers, or use `subscriberExecution` to
configure execution by subscriber name:

```typescript
import { nextTick } from 'vue'
import { createPlugin } from 'pinia-plugin-subscription'

pinia.use(createPlugin([persistedStateSubscriber], {
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrationScheduler: (run) => {
    nextTick(() => run())
  }
}))
```

### SSR / Nuxt hydration control

The source of truth for hydration policy stays on the subscriber itself. For example, a client-only plugin should declare its execution directly:

```typescript
export const persistedStateSubscriber: PluginSubscriberInterface = {
  name: 'persisted-state',
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrationScheduler: (run) => {
    nextTick(() => run())
  },
  invoke: (context) => {
    // ...
    return true
  }
}
```

Available execution options:

- `environment: 'both' | 'client' | 'server'` — controls where the subscriber is allowed to run.
- `hydration: 'immediate' | 'defer'` — on the client, `defer` schedules execution after hydration.
- `hydrationScheduler` can be provided on a subscriber or through `createPlugin()` options to override execution timing when needed.

See [SSR / Nuxt best practices](#ssr--nuxt-best-practices) for guidance on matching the runtime policy to the app lifecycle.

## Execution policy recap

The example above shows the recommended pattern for SSR / Nuxt-safe plugins:

- `execution.environment` restricts the subscriber to `'both'`, `'client'`, or `'server'`
- `execution.hydration` is `'immediate'` by default and can be set to `'defer'` when the plugin must wait for client hydration
- `hydrationScheduler` lets you override the runtime scheduling behavior, for example with Nuxt/Vue `nextTick()`
- `hydrate()` / `afterHydration()` are optional lifecycle hooks for browser-only initialization and post-hydration work; they help keep SSR-sensitive logic out of constructors

## The `Store` Class — Summary

The `Store` class (see [src/core/Store.ts](../src/core/Store.ts)) is a wrapper around a `PiniaStore` providing:

- **Properties:** `options`, `state`, `store`.
- **Useful methods:**
  - `addToState(name, value?)` — adds a property to store state and exposes it as a `Ref` when appropriate.
  - `addSubscription(pluginName, subscription)` — registers a plugin-specific subscription function.
  - `getSubscriptions()` — returns registered subscriptions.
  - `storeSubscribe` (getter/setter) — factory for `store.$subscribe` ({ store, callback }).
  - `onAction` (getter/setter) — factory for `onAction` ({ store, callback }).
  - `static customizeStore(store, options)` — recommended factory for class instantiation.
  - Protected `trace(label, scope?, payload?, namespace?)` — emits a structured trace event, scoped to the store by default when its tracer is configured.
  - Protected `traceError(label, error, scope?, payload?, namespace?)` — emits an error event, or reports it with `console.error` when no tracer is configured.
  - Helpers: `stateHas()`, `storeHas()`, `getValue()`.

`Store`, `PluginSubscriber` and `PluginSubscription` share
protected tracing and store-event emission helpers.

## Testing

- `npm run dev` — runs the dedicated demo app in [`demo/`](../demo/). The library build remains `npm run build` and is intentionally kept separate from the demo entry.
- `npm test` — runs the Vitest suite, including typecheck tests (`*.test-d.ts`) validating type-level contracts such as `StoreOptionsExtensions` merging. Coverage reports are available in `coverage/`.
- `npm run bundle:check` — measures the emitted bundle size.

### Dependency leak guard

Published artifacts must only reference **peer dependencies** (`pinia`, `vue`) and Node builtins. A `devDependency` referenced from `src/` does not fail the local build, but it breaks consumers: Vite inlines runtime imports, while `tsc` keeps bare `import type` specifiers in the emitted `.d.ts`, which consumers cannot resolve.

`npm run check:leaks` scans every built `.js` and `.d.ts` file and fails the build when a non-peer package appears:

```bash
npm run check:leaks
```

It runs automatically as part of `npm run build` and in CI. If it reports a leak, either remove the import from `src/`, or duplicate the required type into `src/types/`.

## Reference implementation

The demo app in [`demo/`](../demo/) includes class-based, plain-object, and
SSR-aware subscribers. Run `npm run dev` for client-only rendering or
`npm run dev:ssr` to run the Vite SSR server and hydrate the rendered page in
the browser. Its two subscribers hydrate the same store from different environments: a
server-only one loads request data (the server waits for its async `hydrate()` before
rendering) and a client-only, deferred one reads browser APIs after hydration. Both modes
resolve the package to `src/`, so no build is needed. See also
[`demo/README.md`](../demo/README.md).

| Style | Files | Shows |
| --- | --- | --- |
| Class-based | [`demo/plugins/DemoPluginClass.ts`](../demo/plugins/DemoPluginClass.ts), [`demo/core/DemoStore.ts`](../demo/core/DemoStore.ts) | `PluginSubscriber` subclass, `Store` subclass, `hasRequiredKeys` gating, store augmentation (`this.state`, `this.store`), `onAction` / `storeSubscribe`, `trace()` |
| Plain object | [`demo/plugins/demoPluginObject.ts`](../demo/plugins/demoPluginObject.ts) | `createPluginSubscriber()`, per-store opt-in through `storeOptions`, `createTracer`, `traceGroups` |
| Environment-aware hydration | [`demo/plugins/demoPluginEnvironmentHydration.ts`](../demo/plugins/demoPluginEnvironmentHydration.ts), [`demo/core/VisitorEnvironmentStore.ts`](../demo/core/VisitorEnvironmentStore.ts), [`demo/stores/visitor-environment.ts`](../demo/stores/visitor-environment.ts), [`demo/entry-server.ts`](../demo/entry-server.ts) | One store hydrated by a server-only subscriber (awaited before render and serialization) and a client-only `hydration: 'defer'` subscriber; each is skipped in the other environment; traces via `Store.trace()` and the `onMutation` group |
| Enhanced store | [`demo/stores/enhanced-store.ts`](../demo/stores/enhanced-store.ts), [`demo/components/EnhancedExample.vue`](../demo/components/EnhancedExample.vue) | `defineAStoreCtx` + `getEnhancedStore` consuming the `DemoStore` augmentations |
| Option typing | [`demo/types/plugin.ts`](../demo/types/plugin.ts) | Extending `StoreOptions` with plugin options |
| Registration & tracing | [`demo/app.ts`](../demo/app.ts) | `createPlugin()` with several subscribers, `createTraceDevtools()` from `pinia-plugin-subscription-devtools` |
| Rollback | [`demo/stores/rollback-snapshot.ts`](../demo/stores/rollback-snapshot.ts), [`demo/components/Example.vue`](../demo/components/Example.vue) | `rollbackAfterFailure` option vs manual `$rollbackAfterFailure()` |

Open the browser console to see the trace output of the
`rollbackSnapshotStoreWithRollback` scope.
