 # pinia-plugin-subscription

 Pinia plugin for Vue.js that helps building Pinia plugins by centralizing subscriber registration and providing a `Store` base class for store helpers.

 This project provides:
 - a lightweight mechanism to declare "subscribers" that are invoked when stores are registered or updated by Pinia;
 - a `Store` base class (helper wrapper) to ease interacting with Pinia stores from subscribers or other plugin code;
 - an API to create a Pinia plugin from a list of subscribers;
 - the $reset method to all stores modified by the plugin.

 The main goal is to offer a clear API for writing reusable Pinia plugins and to make it easy to extend stores from plugin code.

## Installation

Ensure Pinia is installed, then register the plugin in your `main.ts`:

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, PLUGIN_NAME as PPS } from 'pinia-plugin-subscription'
import { myStoreSubscriber } from './src/core/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Register plugin (subscribers array, debug mode)
pinia.use(createPlugin([myStoreSubscriber], [PPS]))

app.use(pinia)
app.mount('#app')
```

## Usage — Examples

**1) Subscriber using a `Store` subclass:**

```typescript
import PluginSubscriber from 'pinia-plugin-subscription'
import { Store } from 'pinia-plugin-subscription'

class MyPlugin extends Store {
  protected override _className: string = 'MyPlugin'
  protected static override _requiredKeys?: string[] | undefined = ['my-plugin-option']

  constructor(store, options, debug = false) {
    super(store, options, debug)
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

## Advanced Features

- **Debug mode:** Specifies the name of the plugin(s) to debug as the second argument to `createPlugin` to enable detailed logging.
- **Reset callbacks:** Define `resetStoreCallback` to run custom logic when a store is reset.
- **SSR and hydration control:** Configure whether each subscribed plugin runs on the server, the client, or only after client hydration.
- **Lifecycle safety:** Internal hydration ordering is now guarded so `hydrate()` completes before `afterHydration()` and disposed stores do not retain stale subscriber metadata.

## API Reference

### `createPlugin(subscribers: PluginSubscriber[], debug?: string[]): PiniaPlugin`

Creates and returns a Pinia plugin from the provided `subscribers`. Each subscriber is invoked when a store is registered.

### `createHydrationPlugin(subscribers: PluginSubscriber[], options?: PluginSubscriptionOptions): PiniaPlugin`

Creates a Pinia plugin dedicated to SSR / Nuxt hydration orchestration. This helper is useful when a store plugin needs a runtime-specific scheduler or environment override without forcing every app to re-declare the plugin’s execution policy.

```typescript
import { createHydrationPlugin, PLUGIN_NAME as PPS } from 'pinia-plugin-subscription'

pinia.use(createHydrationPlugin([
  persistedStateSubscriber
], {
  debug: [PPS],
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
  invoke: (context, debug) => {
    // ...
    return true
  }
}
```

Available execution options:

- `environment: 'both' | 'client' | 'server'` — controls where the subscriber is allowed to run.
- `hydration: 'immediate' | 'defer'` — on the client, `defer` schedules execution after hydration.
- `hydrationScheduler` can be provided either on a subscriber or via `createHydrationPlugin()` to override the execution timing when needed.

### `defineAStoreCtx(id, setup, options?)`

Use actions or access the state, added by one or more plugins, when defining the store.

```typescript
import { defineAStoreCtx, getEnhancedStore } from 'pinia-plugin-subscription'

type EnhancedStore = { addItem: (value: unknown) => void }

export const useMyStore = defineAStoreCtx('myStore', (ctx) => {
  const enhanced = getEnhancedStore<EnhancedStore>(ctx)

  return {
    addViaEnhanced: (value: unknown) => enhanced.addItem(value)
  }
})
```

`ctx.extensions` now supports:
- `enhancedStore`

The setup context is indexed internally only when `storeOptions.enhancedStore` is set to `true` (this is enabled automatically by `defineAStoreCtx`).
The temporary lookup by store id is now cleaned as soon as the weak-map association is established (and on store dispose), which limits map growth over time.
When `storeOptions.debug` is `true`, setup-context map size transitions are logged for observability.

### `PluginSubscriberInterface`

An object with at least an `invoke(context: PiniaPluginContext, debug?: boolean)` method, plus optional properties:

- `execution?: { environment?: 'both' | 'client' | 'server'; hydration?: 'immediate' | 'defer' }`
- `hydrationScheduler?: (run: () => void) => void`
- `hydrate?: (context, debug) => void | Promise<void>` — optional hook for SSR-safe store initialization after the subscriber is accepted for execution
- `afterHydration?: (context, debug) => void | Promise<void>` — optional lifecycle hook for post-hydration work
- `resetStoreCallback?: (store?: any) => void`
- `storeOnActionSubscription?: { store, callback }` (getter)
- `storeMutationSubscription?: { store, callback }` (getter)
- `subscriptions?: Record<string, Function>` (plugin-specific subscription functions)

## The `PluginSubscriber` Abstract Class

The project provides an abstract `PluginSubscriber` implementation (see [src/plugins/pluginSubscriber.ts](src/plugins/pluginSubscriber.ts)) to simplify creating reusable subscribers.

**Typical usage:**

- The subscriber instantiates a `Store` (or subclass) via a factory (`MyStore.customizeStore`).
- The instance exposes:
  - `subscriptions` (from `getSubscriptions()`)
  - `storeMutationSubscription` (from `storeSubscribe`)
  - `storeOnActionSubscription` (from `onAction`)
  - optional `pluginCreated(store)` hook called after initialization

**Example:**

```typescript
import { nextTick } from 'vue'
import PluginSubscriber from 'pinia-plugin-subscription'
import StoreExtension from './src/extending-pinia-store/core/StoreExtension'
import { addStore } from './src/extending-pinia-store/plugins/stores'

class ExtendingStoreSubscriber extends PluginSubscriber<StoreExtension> {
  constructor() {
    super('extendsPiniaStore', StoreExtension.customizeStore.bind(StoreExtension))

    // Controls when this subscriber may run and whether it should wait for hydration on the client.
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

    // Safe browser-only initialization. This is only called when the policy allows it.
    return this.storeInstance?.hydrate?.()
  }
}

export const extendingStoreSubscriber = new ExtendingStoreSubscriber()
```

This example shows the recommended pattern for SSR / Nuxt-safe plugins:

- `execution.environment` restricts the subscriber to `'both'`, `'client'`, or `'server'`
- `execution.hydration` is `'immediate'` by default and can be set to `'defer'` when the plugin must wait for client hydration
- `hydrationScheduler` lets you override the runtime scheduling behavior, for example with Nuxt/Vue `nextTick()`
- `hydrate()` / `afterHydration()` are optional lifecycle hooks for browser-only initialization and post-hydration work; they help keep SSR-sensitive logic out of constructors

## The `Store` Class — Summary

The `Store` class (see [src/core/Store.ts](src/core/Store.ts)) is a wrapper around a `PiniaStore` providing:

- **Properties:** `debug`, `options`, `state`, `store`.
- **Useful methods:**
  - `addToState(name, value?)` — adds a property to store state and exposes it as a `Ref` when appropriate.
  - `addSubscription(pluginName, subscription)` — registers a plugin-specific subscription function.
  - `getSubscriptions()` — returns registered subscriptions.
  - `storeSubscribe` (getter/setter) — factory for `store.$subscribe` ({ store, callback }).
  - `onAction` (getter/setter) — factory for `onAction` ({ store, callback }).
  - `static customizeStore(store, options, debug?)` — recommended factory for class instantiation.
  - `debugLog(message, args)` — conditional logging.
  - Helpers: `stateHas()`, `storeHas()`, `getValue()`.

## Testing

This plugin is tested with Vitest. Coverage reports are available in the `coverage/` directory.

## License

MIT

## Publishing

Releases are published to npm via GitHub Actions. GitHub releases marked as pre-releases are published with the `beta` dist-tag using `npm publish --tag beta`; stable releases use the default `latest` tag. The workflow uses npm provenance for better supply-chain security and requires a `NPM_TOKEN` secret in the repository settings.