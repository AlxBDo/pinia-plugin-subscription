# pinia-plugin-subscription

Pinia plugin for Vue.js that helps building Pinia plugins by centralizing subscriber registration and providing a `Store` base class for store helpers.

This project provides:
- a lightweight mechanism to declare "subscribers" that are invoked when stores are registered or updated by Pinia;
- a `Store` base class (helper wrapper) to ease interacting with Pinia stores from subscribers or other plugin code;
- an API to create a Pinia plugin from a list of subscribers;
- the `$reset` method on all stores modified by the plugin;
- automatic state rollback on action failure via the `rollbackAfterFailure` store option and the `$rollbackAfterFailure` method.

Deferred subscribers attach their action and reset callbacks to their own store after hydration; disposing a store removes its callbacks. For both rollback APIs, `stateKeys: []` restores the full state on failure.

## Tested & maintained

The package is fully tested with [Vitest](https://vitest.dev/): runtime behavior, type-level contracts (`*.test-d.ts`) and performance regressions are covered, and coverage reports are available in `coverage/`. The full test suite and the build run on every push and pull request through [GitHub Actions](.github/workflows/ci.yml).

## Trust & supply chain

This package is **open source (MIT)** and developed in a [public repository](https://github.com/AlxBDo/pinia-plugin-subscription). You can read, audit, fork and self-host the code at any time — no vendor lock-in, no service-continuity risk.

Development follows these practices:

- **No direct pushes to `main`** — every change lands through a reviewed pull request (branch protection enforced).
- **Commits are GPG-signed** and verified on GitHub.
- **Tests and build gate every merge** — a pull request cannot merge with a failing CI run.
- **npm releases ship with provenance** — each published package is built and signed on GitHub Actions and cryptographically linked to the exact commit and CI run that built it ([example transparency log entry](https://search.sigstore.dev/?logIndex=2811656622)), so you can verify what you install.
- **Security issues are handled privately** — see [SECURITY.md](SECURITY.md) for the reporting process.

## Documentation

The package serves two audiences:

| You want to… | Guide |
| --- | --- |
| Use a compatible plugin (e.g. `pinia-plugin-extending-store`, `pinia-plugin-persist-state`) or this package's built-in store features (`defineAStore`, `$reset`, state rollback) in your app | [Using compatible plugins](docs/using-plugins.md) |
| Build your own pinia plugin on top of `pinia-plugin-subscription` | [Plugin authoring guide](docs/authoring-plugins.md) |

## Installation

```bash
npm install pinia pinia-plugin-subscription
```

Register the plugin in your `main.ts`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin } from 'pinia-plugin-subscription'
import { myStoreSubscriber } from './plugins/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

pinia.use(createPlugin([myStoreSubscriber]))

app.use(pinia)
app.mount('#app')
```

### Import subpaths

## Usage — Examples

**1) Subscriber using a `Store` subclass:**

```typescript
import PluginSubscriber from 'pinia-plugin-subscription'
import { Store } from 'pinia-plugin-subscription'

class MyPlugin extends Store {
  protected override _className: string = 'MyPlugin'
  protected static override _requiredKeys?: string[] | undefined = ['my-plugin-option']

  constructor(store, options) {
    super(store, options)
    this.doSomething()
  }
}

class MyPluginSubscriber extends PluginSubscriber<MyPlugin> {
  constructor() {
    super('my-plugin', MyPlugin.customizeStore.bind(MyPlugin))
  }
}

export const myStoreSubscriber = new MyPluginSubscriber()
```

**2) Simple subscriber implementing `PluginSubscriberInterface`:**

```typescript
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription'

export const myStoreSubscriber: PluginSubscriberInterface = {
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

## Advanced Features

- **Structured tracing:** Subscribe to typed trace events and filter them at runtime, per store or per namespace — see [Tracing](#tracing).
- **Reset callbacks:** Define `resetStoreCallback` to run custom logic when a store is reset.
- **SSR and hydration control:** Configure whether each subscribed plugin runs on the server, the client, or only after client hydration.
- **Lifecycle safety:** Internal hydration ordering is now guarded so `hydrate()` completes before `afterHydration()` and disposed stores do not retain stale subscriber metadata.

## API Reference

### `createPlugin(subscribers: PluginSubscriber[]): PiniaPlugin`

Creates and returns a Pinia plugin from the provided `subscribers`. Each subscriber is invoked when a store is registered.

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

### SSR / Nuxt best practices

`pinia-plugin-subscription` is SSR-safe by design, but the runtime policy still needs to match the actual app lifecycle.

For helper-only imports, the package exposes an additive subpath kept separate from the default library API:

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'
```

For type-only imports, prefer the dedicated public types entry:

```ts
import type { PluginSubscriptionOptions } from 'pinia-plugin-subscription/types'
```

## Development

This example shows the recommended pattern for SSR / Nuxt-safe plugins:

- `execution.environment` restricts the subscriber to `'both'`, `'client'`, or `'server'`
- `execution.hydration` is `'immediate'` by default and can be set to `'defer'` when the plugin must wait for client hydration
- `hydrationScheduler` lets you override the runtime scheduling behavior, for example with Nuxt/Vue `nextTick()`
- `hydrate()` / `afterHydration()` are optional lifecycle hooks for browser-only initialization and post-hydration work; they help keep SSR-sensitive logic out of constructors

## The `Store` Class — Summary

The `Store` class (see [src/core/Store.ts](src/core/Store.ts)) is a wrapper around a `PiniaStore` providing:

- **Properties:** `options`, `state`, `store`.
- **Useful methods:**
  - `addToState(name, value?)` — adds a property to store state and exposes it as a `Ref` when appropriate.
  - `addSubscription(pluginName, subscription)` — registers a plugin-specific subscription function.
  - `getSubscriptions()` — returns registered subscriptions.
  - `storeSubscribe` (getter/setter) — factory for `store.$subscribe` ({ store, callback }).
  - `onAction` (getter/setter) — factory for `onAction` ({ store, callback }).
  - `static customizeStore(store, options)` — recommended factory for class instantiation.
  - `trace(namespace, payload?)` — emits a structured trace event scoped to the store.
  - `traceError(namespace, error, payload?)` — emits an error event, or reports it with `console.error` when no listener matches.
  - Helpers: `stateHas()`, `storeHas()`, `getValue()`.

## Tracing

Tracing is **opt-in**, scoped to an explicit registry, and **allocation free when unused**. Create one registry per application or Pinia instance, then pass its `createTracer` factory to `createPlugin()` so plugin and store events share its listeners. For SSR, create a fresh registry, Pinia instance, and plugin instance for every request; do not keep them in module-level state or clear a shared registry at request completion, since requests may overlap. See the [SSR guide](./docs/using-plugins.md#ssr--nuxt) for an example.

### Production safety

Tracing is **not automatically blocked in production**. Leave normal tracing disabled by default using your application's environment configuration; enable production diagnostics only deliberately and with limited scope and duration.

Events are **not automatically redacted** and may include sensitive action arguments, store state, plugin options, or error details. Filters select events by metadata; they do not sanitize payloads. Before writing to a console or forwarding to a logging service, select an allowlist of fields and redact sensitive values rather than sending complete events.

**Disabling normal tracing does not disable error reporting.** Errors can still be sent to `console.error` without a tracer or when no listener matches. See [Error reporting](#error-reporting) and the [security guidance](./SECURITY.md#tracing-and-production-logging) for precautions, including log access and retention.

### Consuming events

```ts
import { createPlugin, createTracerRegistry } from 'pinia-plugin-subscription'

const traceRegistry = createTracerRegistry()
const remove = traceRegistry.addTraceListener({
  filter: (event) => event.scope === 'cart' && event.namespace.startsWith('subscription:'),
  handler: (event) => console.log(event.namespace, event.scope, event.payload)
})

pinia.use(createPlugin(subscribers, {
  createTracer: traceRegistry.createTracer
}))

remove() // unsubscribe
```

`filter` is evaluated on every event, so you can narrow tracing to a single store without rebuilding. Registries do not share listeners with one another.

### Event shape

| Field | Description |
| --- | --- |
| `namespace` | Structured identifier, e.g. `subscription:delivery` |
| `source` | Emitting class name, e.g. `PluginSubscription` |
| `scope` | Instance identifier, usually `store.$id` |
| `payload` | Event data, resolved only when consumed |
| `level` | `debug` or `error` |
| `timestamp` | `Date.now()` at emission |
| `error` | Present on `error` events |

Namespaces emitted by the plugin: `plugin:invoke`, `store:action`, `store:mutation`, `store:reset`, `subscription:delivery`, `subscriber:execute`, `subscriber:hydrate`, `subscriber:afterHydration`.

### Emitting your own events

```ts
class CartStore extends Store {
  hydrate() {
    this.trace('cart:hydrate', () => ({ items: this.state.items }))
  }
}
```

Always prefer the **function form** for `payload`: it is only invoked once a listener matches, so unobserved tracing costs nothing.

### Console listener

Normal trace events do not write to a console. Console output for those events is an opt-in listener:

```ts
import {
  createTracerRegistry,
  createConsoleTraceListener
} from 'pinia-plugin-subscription'

const traceRegistry = createTracerRegistry()
const remove = traceRegistry.addTraceListener(createConsoleTraceListener())
```

By default, this listener uses the styled plugin console. Pass any object exposing `log` and `error` to use another target:

Any object exposing `log` and `error` satisfies the `Console` interface, so external logging libraries can be connected without this plugin depending on them:

```ts
const remove = traceRegistry.addTraceListener(createConsoleTraceListener(myLogger))
```

### Error reporting

An error is delivered to every matching listener. If no listener matches — including when listeners exist but all filters reject the event — it is reported with `console.error`; it is not rethrown. Errors thrown by filters or handlers are also reported and isolated so they do not interrupt the traced process or remaining listeners.

### Migrating from `debugLog()` / `logError()`

These methods were removed in favour of structured events:

```ts
// before
this.debugLog(`$subscribe ${store.$id}`, { mutation, store })
this.logError('subscriptionDelivery()', error, store, options)

// after
this.trace('store:mutation', () => ({ mutation, store }))
this.traceError('subscription:delivery', error, () => ({ store, options }))
```

The `namespace` replaces the formatted message, store trace events are scoped to `store.$id`, and the payload becomes a factory so it is only built when a listener consumes the event.

## Testing

- `npm run dev` — runs the dedicated demo app. The library build remains `npm run build` and is intentionally kept separate from the demo entry. The demo ships a complete plugin-authoring example in [`src/demo/extending-pinia-store/`](src/demo/extending-pinia-store/).
- `npm test` — runs the Vitest suite, including typecheck tests (`*.test-d.ts`) validating type-level contracts such as `StoreOptionsExtensions` merging. Coverage reports are available in `coverage/`.
- `npm run bundle:check` — measures the emitted bundle size.

### Dependency leak guard

Published artifacts must only reference **peer dependencies** (`pinia`, `vue`) and Node builtins. A `devDependency` referenced from `src/` does not fail the local build, but it breaks consumers: Vite inlines runtime imports, while `tsc` keeps bare `import type` specifiers in the emitted `.d.ts`, which consumers cannot resolve.

`npm run check:leaks` scans every built `.js` and `.d.ts` file and fails the build when a non-peer package appears:

```bash
npm run check:leaks
```

It runs automatically as part of `npm run build` and in CI. If it reports a leak, either remove the import from `src/`, or duplicate the required type into `src/types/`.

## License

MIT

## Publishing

Releases are published to npm via GitHub Actions. GitHub releases marked as pre-releases are published with the `beta` dist-tag using `npm publish --tag beta`; stable releases use the default `latest` tag. The workflow uses npm provenance for better supply-chain security and requires a `NPM_TOKEN` secret in the repository settings.
