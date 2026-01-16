 # pinia-plugin-subscription

 ![Pinia](https://img.shields.io/badge/Pinia-2.x-blue?logo=pinia) ![Vue](https://img.shields.io/badge/Vue-3.x-brightgreen?logo=vue.js) ![Nuxt](https://img.shields.io/badge/Nuxt-3.x-00C58E?logo=nuxt.js) ![Vitest](https://img.shields.io/badge/Vitest-tested-brightgreen?logo=vitest)

 Pinia plugin for Vue.js that helps building Pinia plugins by centralizing subscriber registration and providing a `Store` base class for store helpers.

 This project provides:
 - a lightweight mechanism to declare "subscribers" that are invoked when stores are registered or updated by Pinia;
 - a `Store` base class (helper wrapper) to ease interacting with Pinia stores from subscribers or other plugin code;
 - an API to create a Pinia plugin from a list of subscribers.

 The main goal is to offer a clear API for writing reusable Pinia plugins and to make it easy to extend stores from plugin code.

### Basic usage

1. Import the plugin factory and register your subscribers with Pinia:

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin } from 'pinia-plugin-subscription'
import myStoreSubscriber from './src/core/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Register plugin (subscribers array, debug  = list of target plugins)
pinia.use(createPlugin([myStoreSubscriber], ['my-plugin']))

app.use(pinia)
app.mount('#app')
```

2. A subscriber example using a `Store` subclass:

```typescript
// src/core/my-store.ts
import { Store } from 'pinia-plugin-subscription'

class MyStore extends Store {
  constructor(store, options, debug = false) {
    super(store, options, debug)
    this.doSomething()
  }

  private doSomething() {
    try {
      console.log('store', this.store)
      console.log('state', this.state)
      console.log('store options', this.options)

      // conditionaly property added
      if(
          (!this.stateHas('myProperty') || this.getStatePropertyValue('myProperty') === 'old-value') 
          && this.storeHas('myAction')
      ){
        this.addToState('myProperty', 'new-value')
      }
    } catch(e) {
      this.debugLog(e)
    }
  }
}

export const myStoreSubscriber = {
  name: 'my-plugin'
  invoke: (context, debug) => {
    // create an instance of the Store subclass when options.storeOptions is present
    const myStore = MyStore.customizeStore(context.store, context.options, debug)
    if (!myStore) return

    //Execute logic if store is augmented by plugin
    doAnotherthing(myStore)
  },
  resetStoreCallback: (store) => {
    console.log('[subscriber] store reset:', store?.$id)
  }
}
```

 ### Advanced usage

 #### Debug mode

 Enable debug mode to log store changes and internal actions:

 ```typescript
 pinia.use(createPlugin([subscriber], true))
 ```

 #### Reset store callbacks

 Subscribers may define `resetStoreCallback` to run custom logic when a store reset is handled by the plugin.

 ```typescript
 const subscriber = {
   invoke: (context, debug) => {
     console.log('Store changed:', context.store.$state)
   },
   resetStoreCallback: (store) => {
     console.log('Store reset:', store.$id)
   }
 }
 ```

 ## API

 ### `createPlugin(subscribers: PluginSubscriber[], debug?: boolean): PiniaPlugin`

 Creates a Pinia plugin from the provided `subscribers` and optional `debug` flag. Each subscriber will be invoked with the Pinia plugin context when a store is registered.

 ### `PluginSubscriberInterface`

The `PluginSubscriberInterface` interface has been extended: it's still an object with at least an `invoke(context: PiniaPluginContext, debug?: boolean)` method, but it can now expose several useful properties for plugins:

- **`resetStoreCallback?: (store?: Store) => void`**: callback invoked when the store is reset.
- **`storeOnActionSubscription?: StoreOnActionSubscription`**: provides a native Pinia `onAction` subscription via a getter returning `{ store, callback }`.
- **`storeMutationSubscription?: StoreMutationSubscription`**: provides a native mutation subscription (`store.$subscribe`) via a getter returning `{ store, callback }`.
- **`subscriptions: PluginSubscriptions | undefined`**: an object listing plugin-specific subscription functions (see `Store.addSubscription`).

These additions make it easier for subscribers to integrate with Pinia's native event cycle and to expose reusable extension points.

## The `PluginSubscriber` class (abstract)

The project provides an abstract `PluginSubscriber` implementation ([src/plugins/pluginSubscriber.ts](src/plugins/pluginSubscriber.ts)) that makes it easy to create reusable subscribers:

- Constructor: `new PluginSubscriber(pluginName: string, createInstanceFunction: CreateInstance)`
- Main behavior: in `invoke(context, debug)` the class creates a helper instance (`Store` or subclass) via the `createInstanceFunction` (typically `MyStore.customizeStore`) and exposes on the instance:
  - `subscriptions` (from `store.getSubscriptions()`)
  - `storeMutationSubscription` (from `store.storeSubscribe`)
  - `storeOnActionSubscription` (from `store.onAction`)
  - optionally a `pluginCreated(store)` hook called after initialization


```typescript
import PluginSubscriber from './src/plugins/pluginSubscriber'
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

Here `ExtendingStoreSubscriber` provides a `createInstanceFunction` that returns a `StoreExtension` instance if `options.storeOptions` is present, and sets a `pluginCreated` hook (here `addStore`) to run plugin-specific logic once the instance is ready.

 ## The `Store` class (summary)

 The `Store` class (in [src/core/Store.ts](src/core/Store.ts)) is a base wrapper around a `PiniaStore` exposing helpers:

 - Properties: `debug`, `options`, `state`, `store`.
 - Useful methods:
   - `addToState(name, value?)`: adds a property to the store state and exposes it as a `Ref` on the store when appropriate.
   - `addSubscription(pluginName, subscription)`: registers a plugin-specific subscription function (accessible via `getSubscriptions`).
   - `getSubscriptions()`: returns subscriptions registered with `addSubscription` (or `undefined`).
   - `storeSubscribe` (getter/setter): exposes a mutation subscription callback (`store.$subscribe`) as a factory returning `{ store, callback }`.
   - `onAction` (getter/setter): exposes a Pinia `onAction` callback in the same form.
   - `static customizeStore(store, options, debug?)`: instantiate the class (or subclass) when `options.storeOptions` is present.
   - `debugLog(message, args)`: conditional logging when `debug` is true.
   - `hasDeniedFirstChar(property)`, `getOption(...)`, `getValue(value)`, `getStatePropertyValue(...)`.
   - `isOptionApi()`: true when the store uses Pinia Options API.

Other small helpers exposed: `stateHas(property)`, `storeHas(property)` and `getValue` to retrieve the real value of a `Ref` or a raw value.

 `Store.customizeStore(...)` is the recommended entry point used by subscribers to create store helper instances.

  
 ## Testing

  This plugin is tested with Vitest. Coverage (from the included coverage report at [coverage/index.html](coverage/index.html)):

  - Statements: **97.64%** (83/85)
  - Branches: **86.53%** (45/52)
  - Functions: **100%** (38/38)
  - Lines: **97.59%** (81/83)


## Notes

The $reset method is available for stores augmented by the plugin (also compositionApi store 😁).

---

## License

MIT
