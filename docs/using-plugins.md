# Using compatible plugins

Guide for **application developers** who consume plugins built on
`pinia-plugin-subscription` (for example `pinia-plugin-extending-store` or
`pinia-plugin-persist-state`), or who use this package's built-in store
features directly.

If you want to **build your own pinia plugin** on top of this package, read
the [plugin authoring guide](authoring-plugins.md) instead.

> **Documentation convention:** JavaScript examples come first and are
> complete and runnable as-is. TypeScript versions follow, adding type
> annotations and generics. Types are always optional at runtime — they only
> add autocompletion and compile-time checks.

## What every compatible plugin guarantees

Plugins built on `pinia-plugin-subscription` share a common contract:

- **Single registration point** — all subscribers are registered through one
  `createPlugin()` call.
- **`$reset` on registered stores** — every store registered by the plugin
  gains a `$reset()` method that restores its initial state, including
  setup-style stores where pinia does not provide one natively.
- **Per-plugin debug mode** — pass plugin names to `createPlugin()` to
  enable detailed logging for those plugins only.
- **SSR-safe execution** — each plugin declares where (`client`, `server`
  or `both`) and when (`immediate` or deferred after hydration) it runs.
- **State rollback on action failure** — actions listed in the
  `rollbackAfterFailure` store option automatically restore their state
  snapshot when they throw.

## Installation

```bash
npm install pinia pinia-plugin-subscription
```

## Registering compatible plugins

Compatible plugins expose **subscribers** that are passed to
`createPlugin()`.

### JavaScript

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, PLUGIN_NAME } from 'pinia-plugin-subscription'
import { myStoreSubscriber } from './plugins/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Second argument (optional): names of the plugins to debug.
pinia.use(createPlugin([myStoreSubscriber], [PLUGIN_NAME]))

app.use(pinia)
app.mount('#app')
```

### TypeScript

The TypeScript version is identical — `createPlugin()` is fully typed and
requires no generics:

```ts
import { createPlugin, PLUGIN_NAME } from 'pinia-plugin-subscription'
import type { PluginSubscriberInterface } from 'pinia-plugin-subscription'

const subscribers: PluginSubscriberInterface[] = [myStoreSubscriber]

pinia.use(createPlugin(subscribers, [PLUGIN_NAME]))
```

## Defining stores: `defineAStore`

`defineAStore()` is a drop-in replacement for pinia's `defineStore()` that
wires the store to receive plugin options while preserving the full
TypeScript typing of the store and its state.

### Signature

```ts
defineAStore(id, storeDefinition, options?)
defineAStore<Sto, Sta>(id, storeDefinition, options?) // explicit typings
```

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique store identifier — same as pinia's `defineStore()`. |
| `storeDefinition` | options object \| setup function | Same shape as pinia's `defineStore()`: an options object (`state`, `getters`, `actions`) or a setup function returning state and actions. |
| `options` | `StoreOptions` (optional) | Per-store plugin options: the built-in `rollbackAfterFailure` key, plus any key contributed by installed plugins through `StoreOptionsExtensions`. |

### Type parameters (TypeScript only)

The type parameters are **optional**. When they are omitted, the state,
getters and actions are inferred from the store definition (the setup
function return or the options object), exactly like pinia's `defineStore()`
— IDEs list the store members and display action prototypes at every call
site.

| Generic | Role |
| --- | --- |
| `Sto` | Interface describing the store's exposed behavior (actions and getters). |
| `Sta` | Interface describing the store's state. |

Provide `Sto` and `Sta` explicitly when plugins augment the store with
members not returned by the setup function: the returned definition is then
typed as `DefineAStoreDefinition<Sto, Sta>`, whose call signature exposes
`Sto` and `Sta` on the store. `DefineAStoreDefinition` extends pinia's
`StoreDefinition`, so the returned `useStore` stays assignable wherever a
standard store definition is expected.

### JavaScript example

No generics, no annotations — the function behaves like `defineStore()`
plus plugin options (in TypeScript, the store members are inferred from the
returned object):

```js
import { ref } from 'vue'
import { defineAStore } from 'pinia-plugin-subscription'

export const useCounterStore = defineAStore('counter', () => {
  const count = ref(0)

  function increment() {
    count.value++
  }

  return { count, increment }
}, {
  rollbackAfterFailure: { increment: ['count'] }
})
```

### TypeScript example (setup style)

```ts
import { ref } from 'vue'
import { defineAStore } from 'pinia-plugin-subscription'

export interface CounterState {
  count: number
}

export interface CounterStore {
  increment: () => void
}

export const useCounterStore = defineAStore<CounterStore, CounterState>(
  'counter',
  () => {
    const count = ref(0)

    function increment() {
      count.value++
    }

    return { count, increment }
  }
)

// Consumption is fully typed:
// const store = useCounterStore()
// store.count       → number
// store.increment() → void
```

### TypeScript example (options style)

```ts
import { defineAStore } from 'pinia-plugin-subscription'

export interface ResourceId {
  '@id'?: string
  id?: string
}

export const useResourceIdStore = defineAStore('resourceId', {
  state: (): ResourceId => ({
    '@id': undefined,
    id: undefined
  }),

  actions: {
    setData(data: Partial<ResourceId>) {
      if (data['@id']) { this['@id'] = data['@id'] }
      if (data.id) { this.id = data.id }
    }
  }
})
```

## Using plugin-added features at definition time: `defineAStoreCtx`

When a plugin adds state or actions to your stores (an "enhanced store"),
`defineAStoreCtx()` lets your setup function use those additions while the
store is being defined.

### Signature

```ts
defineAStoreCtx(id, setup, options?)
defineAStoreCtx<Sto, Sta, TExtraExtensions>(id, setup, options?) // explicit typings
```

| Generic | Role |
| --- | --- |
| `Sto` | Store behavior interface (as in `defineAStore`, optional — inferred when omitted). |
| `Sta` | Store state interface (as in `defineAStore`, optional — inferred when omitted). |
| `TExtraExtensions` | Extra extension keys available on `ctx.extensions` (optional). |

The setup function receives a `ctx` object with `{ id, extensions }`. Use
`getEnhancedStore<T>()` to retrieve the plugin-added store API:

```ts
import { defineAStoreCtx, getEnhancedStore } from 'pinia-plugin-subscription'

type EnhancedStore = { addItem: (value: unknown) => void }

export const useMyStore = defineAStoreCtx('myStore', (ctx) => {
  const enhanced = getEnhancedStore<EnhancedStore>(ctx)

  return {
    addViaEnhanced: (value: unknown) => enhanced.addItem(value)
  }
})
```

`defineAStoreCtx()` enables the `enhancedStore` store option automatically.
The internal setup-context lookup is cleaned up as soon as the store is
associated (and on store dispose), which limits map growth over time. When
`storeOptions.debug` is `true`, setup-context map size transitions are
logged for observability.

## `$reset` on registered stores

Every store registered by the plugin exposes `$reset()`, which restores the
initial state captured at registration — including for setup-style stores:

```js
const store = useCounterStore()
store.increment()
store.$reset() // state is back to its initial value
```

Each compatible plugin may also run custom logic on reset — see the plugin's
own documentation.

## State rollback on action failure

The plugin can automatically restore the previous state when an action
throws. Declare the state keys to snapshot per action via the
`rollbackAfterFailure` store option:

```js
import { ref } from 'vue'
import { defineAStore } from 'pinia-plugin-subscription'

export const useMyStore = defineAStore('myStore', () => {
  const count = ref(0)

  function riskyAction() {
    count.value += 1
    throw new Error('Something went wrong')
  }

  return { count, riskyAction }
}, {
  rollbackAfterFailure: {
    // only the listed keys are snapshotted / restored (deep-cloned)
    riskyAction: ['count']
  }
})
```

Before a configured action runs, the declared state keys are snapshotted.
If the action throws (synchronously or by rejecting its returned promise),
the snapshot is restored through `$patch`, so partial mutations are rolled
back. The snapshot is always discarded once the action completes or fails.

Only the actions listed in `rollbackAfterFailure` are snapshotted, so
unrelated actions pay no cloning cost. Use `'all'` instead of a key list to
snapshot the full state — prefer explicit keys for large states.

Action names starting with `_` or `$` are rejected to protect internal store
methods.

### Manual rollback with `$rollbackAfterFailure`

Every store registered by the plugin also exposes a `$rollbackAfterFailure`
method to run any action with an explicit snapshot/rollback wrapper, without
declaring it in the store options:

```js
const store = useMyStore()

try {
  await store.$rollbackAfterFailure(
    { action: 'riskyAction', stateKeys: ['count'] },
    ['firstArgument', 'secondArgument'] // action arguments, as a single array
  )
} catch (error) {
  // the action failed and the state was restored
}
```

- `params.action` — the name of the action to execute.
- `params.stateKeys` — optional; the state keys to snapshot, or `'all'`
  (default when omitted or empty).
- `args` — optional; the action arguments, provided as a single array
  (forwarded to the action via `apply()`).
- The original error is rethrown after the state is restored.

## Debug mode

Pass the names of the plugins you want to inspect as the second argument of
`createPlugin()`:

```js
pinia.use(createPlugin([myStoreSubscriber], [PLUGIN_NAME, 'my-plugin']))
```

Matching plugins then emit detailed logs (registration, execution policy,
hydration lifecycle).

## SSR / Nuxt

The package is SSR-safe by design. Each compatible plugin declares its own
execution policy, so nothing browser-only runs on the server unless the
plugin explicitly allows it.

When a plugin needs a runtime-specific scheduler or environment override —
without forcing every app to re-declare the plugin's execution policy —
register it through the dedicated hydration helper:

```js
import { nextTick } from 'vue'
import { createHydrationPlugin, PLUGIN_NAME } from 'pinia-plugin-subscription'

pinia.use(createHydrationPlugin([persistedStateSubscriber], {
  debug: [PLUGIN_NAME],
  hydrationScheduler: (run) => {
    nextTick(() => run())
  }
}))
```

`createHydrationPlugin(subscribers, options?)` accepts
`PluginSubscriptionOptions`:

| Option | Type | Description |
| --- | --- | --- |
| `debug` | `string[]` | Plugin names to debug. |
| `execution` | `PluginExecutionOptions` | Global execution policy override. |
| `hydrationScheduler` | `(run: () => void) => void` | Scheduler used for deferred hydration. |
| `runtimeEnvironment` | `'client' \| 'server'` | Forces the runtime environment. |
| `subscriberExecution` | `Record<string, PluginExecutionOptions>` | Per-subscriber execution overrides, keyed by subscriber name. |

If you are authoring a plugin and need to declare its SSR policy, see the
[execution policy & SSR section](authoring-plugins.md#execution-policy--ssr)
of the authoring guide.

## Ecosystem

Plugins built on `pinia-plugin-subscription`:

- `pinia-plugin-extending-store`
- `pinia-plugin-persist-state`

Check each plugin's own README for its specific store options and behavior.
