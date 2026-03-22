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
import { createPlugin } from 'pinia-plugin-subscription'
import { myStoreSubscriber } from './src/core/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Register plugin (subscribers array, debug mode)
pinia.use(createPlugin([myStoreSubscriber], true))

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

- **Debug mode:** Pass `true` as the second argument to `createPlugin` to enable detailed logging and plugin filtering.
- **Reset callbacks:** Define `resetStoreCallback` to run custom logic when a store is reset.

## API Reference

### `createPlugin(subscribers: PluginSubscriber[], debug?: boolean): PiniaPlugin`

Creates and returns a Pinia plugin from the provided `subscribers`. Each subscriber is invoked when a store is registered.

### `PluginSubscriberInterface`

An object with at least an `invoke(context: PiniaPluginContext, debug?: boolean)` method, plus optional properties:

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
import PluginSubscriber from 'pinia-plugin-subscription'
import StoreExtension from './src/extending-pinia-store/core/StoreExtension'
import { addStore } from './src/extending-pinia-store/plugins/stores'

class ExtendingStoreSubscriber extends PluginSubscriber<StoreExtension> {
  constructor() {
    super('extendsPiniaStore', StoreExtension.customizeStore.bind(StoreExtension))
    this.pluginCreated = addStore
  }
}

export const extendingStoreSubscriber = new ExtendingStoreSubscriber()
```

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