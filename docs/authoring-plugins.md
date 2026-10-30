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
  subscriptions, action subscriptions, reset callbacks), and declare an
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
  },

  resetStoreCallback: (store) => {
    console.log('store reset:', store.$id)
  }
}
```

### TypeScript

```ts
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/helpers'

export const myStoreSubscriber: PluginSubscriberInterface = {
  name: 'my-plugin',

  invoke: (context) => {
    console.log('store registered', context.store.$id)

    return true
  },

  resetStoreCallback: (store) => {
    console.log('store reset:', store.$id)
  }
}
```

### With the `createPluginSubscriber()` factory

`createPluginSubscriber(name, invoke, optionalProps?)` builds the same plain object with `name` and `invoke` as positional arguments. `optionalProps` accepts any other `PluginSubscriberInterface` member (`afterHydration`, `execution`, `hydrate`, `hydrationScheduler`, `resetStoreCallback`, `storeOnActionSubscription`, `storeMutationSubscription`, `subscriptions`).

```ts
import { createPluginSubscriber } from 'pinia-plugin-subscription/helpers'

export const myStoreSubscriber = createPluginSubscriber(
  'my-plugin',
  (context, createTracer) => {
    console.log('store registered', context.store.$id)

    return true
  },
  {
    resetStoreCallback: (store) => console.log('store reset:', store.$id)
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
| `resetStoreCallback` | `(store?: Store) => void` | Custom logic executed when a registered store is reset. |
| `storeOnActionSubscription` | `(context: PiniaPluginContext) => { store, callback }` | Receives the Pinia plugin context and returns an action subscription forwarded to the store's `$onAction`. Multiple subscribers can target the same store through a single `$onAction` hook; subscriptions are attached after deferred hydration and removed on store disposal. |
| `storeMutationSubscription` | `() => { store, callback }` | Returns a mutation subscription forwarded to pinia's `$subscribe`. Several subscribers can target the same store through a single `$subscribe` hook; callback errors are isolated and traced, and the hook is unsubscribed on store disposal. |
| `subscriptions` | `Record<string, PluginSubscription>` | Plugin-specific subscription functions exposed to other plugins. |

All members except `name` and `invoke` are optional.

## The `PluginSubscriber` abstract class

For class-based plugins, extend `PluginSubscriber<Instance>`. The subscriber
creates the instance through a factory — conventionally
`MyPlugin.customizeStore.bind(MyPlugin)`.

### Type parameter (TypeScript only)

| Generic | Constraint | Role |
| --- | --- | --- |
| `Instance` | `extends Store` | The `Store` subclass your plugin creates for each registered store. |

The generic parameter is optional — JavaScript code and untyped TypeScript
plugins can extend the class without it. Providing it types the
`storeInstance` getter, so overridden hooks (`hydrate()`,
`afterHydration()`, `pluginCreated`) get full autocompletion and compile-time
checks when they call your plugin's custom methods.

Constructor:

```ts
constructor(pluginName: string, createInstance: CreateInstance)
```

| Member | Kind | Description |
| --- | --- | --- |
| `execution` | public field | Execution policy (see below). |
| `hydrationScheduler` | public field | Custom scheduler used when hydration is deferred. |
| `pluginCreated` | protected field | Optional hook called with the pinia store after a successful `invoke`. |
| `pluginOptions` | getter/setter | Extra options merged into the options passed to your `Store` factory. |
| `storeInstance` | getter | The `Store` subclass instance created for the current store. |
| `hydrate()` / `afterHydration()` | methods | Lifecycle stubs to override for SSR-safe initialization. |
| `invoke()` | method | Implemented for you: creates the instance, wires `subscriptions`, `storeSubscribe` and `onAction`, then calls `pluginCreated`. Returns `false` when the factory creates no instance. |

### JavaScript

```js
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'

class MyPlugin extends Store {
  constructor(store, options) {
    super(store, options)
    this.doSomething()
  }

  doSomething() {
    this.trace('my-plugin:doSomething', () => ({ storeId: this.store.$id }))
  }
}

class MyPluginSubscriber extends PluginSubscriber {
  constructor() {
    super('my-plugin', (store, options) => new MyPlugin(store, options))
  }
}

export const myStoreSubscriber = new MyPluginSubscriber()
```

### TypeScript

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'

class MyPlugin extends Store {
  protected override _className: string = 'MyPlugin'
  protected static override _requiredKeys?: string[] = ['my-plugin-option']

  constructor(store, options) {
    super(store, options)
    this.doSomething()
  }

  doSomething(): void {
    this.trace('my-plugin:doSomething', () => ({ storeId: this.store.$id }))
  }
}

class MyPluginSubscriber extends PluginSubscriber<MyPlugin> {
  constructor() {
    super('my-plugin', MyPlugin.customizeStore.bind(MyPlugin))
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
| `trace(label, scope?, payload?, namespace?)` | Emits a structured trace event (inherited from the abstract `TraceEmitter` class, shared with `PluginSubscription`). The default scope is the wrapped store ID. |
| `traceError(label, error, scope?, payload?, namespace?)` | Emits an error event; if no listener matches, reports it with `console.error` without rethrowing it. |
| `classNameAddedToTraceNamespace` (getter/setter) | Controls whether the store class name is prefixed to trace labels; enabled by default. |
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
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription/helpers'

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
- `hydrationScheduler` can be provided either on a subscriber or via
  `createHydrationPlugin()` to override the execution timing when needed.

The class-based equivalent sets the same policy in the constructor and
overrides the lifecycle hooks:

```ts
import { nextTick } from 'vue'
import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'

class ExtendingStoreSubscriber extends PluginSubscriber<StoreExtension> {
  constructor() {
    super('extendsPiniaStore', StoreExtension.customizeStore.bind(StoreExtension))

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

  override hydrate() {
    if (typeof window === 'undefined') {
      return
    }

    // Safe browser-only initialization, only called when the policy allows it.
    return this.storeInstance?.hydrate?.()
  }
}
```

### SSR / Nuxt best practices

`pinia-plugin-subscription` is SSR-safe by design, but the runtime policy
still needs to match the actual app lifecycle.

Use `hydration: 'defer'` when the subscriber depends on browser-only APIs,
client-side cookies, `localStorage`, DOM access, or a hydrated app state
that must exist only after the app is mounted.

Use `runtimeEnvironment: 'server'` (on `createHydrationPlugin()`) or
`execution.environment: 'server'` when a subscriber is only valid during
server-side rendering or should not touch browser-only objects:

```js
pinia.use(createHydrationPlugin([serverOnlySubscriber], {
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

Use `trace()` and `traceError()` from a `Store` subclass to emit structured
events. The first argument is a human-readable label; by default the store
class name is prefixed to it and the normalized label becomes the namespace.
Pass an explicit fourth `namespace` argument to control the namespace, or set
`classNameAddedToTraceNamespace = false` to omit the class prefix. Prefer a
payload factory so data is not built unless a listener consumes the event:

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

`createTracerRegistry()` is available from
`pinia-plugin-subscription/helpers`. Register event criteria with
`addListener()` and pass the registry's `tracerHandler` through
`createPlugin()` options to group plugin and store events in the console.
Criteria target event metadata and support `equals`, `contains`, `startsWith`
and `endsWith` comparisons. See the [Tracing documentation](./tracing.md) for
filtering, redaction, production safety and error reporting.

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
  rollbackAfterFailure: { save: 'all' },  // built-in option
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

Creates and returns a Pinia plugin from the provided `subscribers`. Each subscriber is invoked when a store is registered. The optional `options` configure execution, hydration and tracing.

### `createPluginSubscriber(name: string, invoke: PluginSubscriberInvoke, optionalProps?: Omit<PluginSubscriber, 'name' | 'invoke'>): PluginSubscriber`

Factory returning a plain-object subscriber `{ name, invoke, ...optionalProps }`. Exported from `pinia-plugin-subscription/helpers`.

### `createHydrationPlugin(subscribers: PluginSubscriber[], options?: PluginSubscriptionOptions): PiniaPlugin`

Deprecated. Use `createPlugin()` with hydration options instead. This helper remains available for compatibility.

```typescript
import { createPlugin } from 'pinia-plugin-subscription'

pinia.use(createPlugin([
  persistedStateSubscriber
], {
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
  - `trace(label, scope?, payload?, namespace?)` — emits a structured trace event, scoped to the store by default.
  - `traceError(label, error, scope?, payload?, namespace?)` — emits an error event, or reports it with `console.error` when no listener matches.
  - Helpers: `stateHas()`, `storeHas()`, `getValue()`.

`trace()` and `traceError()` come from the abstract `TraceEmitter` class that `Store` shares with `PluginSubscription`.

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
| Registration & tracing | [`demo/main.ts`](../demo/main.ts) | `createPlugin()` with several subscribers, `createTracerRegistry()`, `addScopesListener()` |
| Rollback | [`demo/stores/rollback-snapshot.ts`](../demo/stores/rollback-snapshot.ts), [`demo/components/Example.vue`](../demo/components/Example.vue) | `rollbackAfterFailure` option vs manual `$rollbackAfterFailure()` |

Open the browser console to see the trace output of the
`rollbackSnapshotStoreWithRollback` scope.
