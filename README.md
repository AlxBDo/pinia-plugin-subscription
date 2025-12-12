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

// Register plugin (subscribers array, debug flag)
pinia.use(createPlugin([myStoreSubscriber]))

app.use(pinia)
app.mount('#app')
```

2. A subscriber example using a `Store` subclass:

```typescript
// src/core/my-store.ts
import Store from './src/core/Store'

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

 ### `PluginSubscriber`

 An object with at least an `invoke(context: PiniaPluginContext, debug?: boolean)` method. Optionally a `resetStoreCallback(store)` method can be provided.

 ## The `Store` class (summary)

 The `Store` class (in [src/core/Store.ts](src/core/Store.ts)) is a base wrapper around a `PiniaStore` exposing helpers:

 - Properties: `debug`, `options`, `state`, `store`.
 - Useful methods:
   - `addToState(name, value?)`: adds a property to the store state and exposes it as a `Ref` on the store when appropriate.
   - `static customizeStore(store, options, debug?)`: instantiate the class (or subclass) when `options.storeOptions` is present.
   - `debugLog(message, args)`: conditional logging when `debug` is true.
   - `hasDeniedFirstChar(property)`, `getOption(...)`, `getValue(value)`, `getStatePropertyValue(...)`.
   - `isOptionApi()`: true when the store uses Pinia Options API.

 `Store.customizeStore(...)` is the recommended entry point used by subscribers to create store helper instances.

  
 ## Testing

  This plugin is tested with Vitest. Coverage (from the included coverage report at [coverage/index.html](coverage/index.html)):

  - Statements: **97.64%** (83/85)
  - Branches: **86.53%** (45/52)
  - Functions: **100%** (38/38)
  - Lines: **97.59%** (81/83)
