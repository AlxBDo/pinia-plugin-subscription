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
   helpers (state extension, subscriptions, debug logging).

## Your first subscriber: a plain object

### JavaScript

```js
export const myStoreSubscriber = {
  name: 'my-plugin',

  invoke: (context, debug) => {
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
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription'

export const myStoreSubscriber: PluginSubscriberInterface = {
  name: 'my-plugin',

  invoke: (context, debug) => {
    console.log('store registered', context.store.$id)

    return true
  },

  resetStoreCallback: (store) => {
    console.log('store reset:', store.$id)
  }
}
```

The host app registers subscribers through `createPlugin()`:

```js
import { createPlugin } from 'pinia-plugin-subscription'

pinia.use(createPlugin([myStoreSubscriber]))
```

## `PluginSubscriberInterface` reference

| Member | Type | Description |
| --- | --- | --- |
| `name` (required) | `string` | Unique plugin name; also used by the debug filter. |
| `invoke` (required) | `(context: PiniaPluginContext, debug: boolean) => boolean` | Called when a store is registered. Return `false` to skip the store. |
| `execution` | `PluginExecutionOptions` | Where/when the subscriber runs — see [Execution policy & SSR](#execution-policy--ssr). |
| `hydrationScheduler` | `(run: () => void) => void` | Custom scheduler used when hydration is deferred. |
| `hydrate` | `(context, debug) => void \| Promise<void>` | SSR-safe initialization hook; guaranteed to run before `afterHydration`. |
| `afterHydration` | `(context, debug) => void \| Promise<void>` | Post-hydration lifecycle hook. |
| `resetStoreCallback` | `(store?: Store) => void` | Custom logic executed when a registered store is reset. |
| `storeOnActionSubscription` | `{ store, callback }` (getter) | Action subscription forwarded to pinia's `$onAction`. |
| `storeMutationSubscription` | `{ store, callback }` (getter) | Mutation subscription forwarded to pinia's `$subscribe`. |
| `subscriptions` | `Record<string, PluginSubscription>` | Plugin-specific subscription functions exposed to other plugins. |
| `console` | `Console` | Custom console used for debug logging. |

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
constructor(pluginName: string, createInstance: CreateInstance, pluginConsole?: Console)
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
import { PluginSubscriber, Store } from 'pinia-plugin-subscription'

class MyPlugin extends Store {
  constructor(store, options, debug = false) {
    super(store, options, debug)
    this.doSomething()
  }

  doSomething() {
    this.debugLog('doSomething', this.store.$id)
  }
}

class MyPluginSubscriber extends PluginSubscriber {
  constructor() {
    super('my-plugin', (store, options, debug, customConsole) =>
      new MyPlugin(store, options, debug, customConsole))
  }
}

export const myStoreSubscriber = new MyPluginSubscriber()
```

### TypeScript

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription'

class MyPlugin extends Store {
  protected override _className: string = 'MyPlugin'
  protected static override _requiredKeys?: string[] = ['my-plugin-option']

  constructor(store, options, debug = false) {
    super(store, options, debug)
    this.doSomething()
  }

  doSomething(): void {
    this.debugLog('doSomething', this.store.$id)
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

**Properties:** `debug`, `options`, `state`, `store`.

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
| `static customizeStore(store, options, debug?)` | Recommended factory; guarded by `_requiredKeys` (see above). |
| `debugLog(message, args)` | Conditional logging, active in debug mode. |
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
  invoke: (context, debug) => {
    // ...
    return true
  }
}
```

### TypeScript

```ts
import { nextTick } from 'vue'
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription'

export const persistedStateSubscriber: PluginSubscriberInterface = {
  name: 'persisted-state',
  execution: {
    environment: 'client',
    hydration: 'defer',
  },
  hydrationScheduler: (run) => {
    nextTick(() => run())
  },
  invoke: (context, debug) => {
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
import { PluginSubscriber } from 'pinia-plugin-subscription'

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

    this.pluginCreated = addStore
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
  `invoke(context, debug)` through `context.options.storeOptions` — no
  extra wiring needed.
- Never redeclare `DefineStoreOptionsBase` or `PiniaCustomProperties`; only
  this package owns those augmentations.

## Reference implementation

The demo app ships a complete plugin implementation in
[`src/demo/extending-pinia-store/`](../src/demo/extending-pinia-store/): a
`PluginSubscriber` subclass, a `Store` subclass, option typing and SSR
guards. Run `npm run dev` to explore it live.
