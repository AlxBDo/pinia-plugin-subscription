# pinia-plugin-state-snapshots

`pinia-plugin-state-snapshots` gives Pinia stores a reset capability and adds
state rollback for actions. In particular, it can provide `$reset` for setup
stores, where Pinia does not supply the Options API's built-in reset method.
The plugin restores a deep clone of the store's initial state, so each reset
starts from the original values rather than reusing mutable references. It can
also restore state when an action fails, helping stores remain consistent
without adding snapshot logic to each action.

## Installation

Install Pinia, Vue, the subscription package, and this plugin:

```bash
npm install pinia vue pinia-plugin-subscription pinia-plugin-state-snapshots
```

This release requires `pinia-plugin-subscription` `1.0.0-beta.16` or later.

## Usage

Register `StateSnapshotsSubscriber` with Pinia through
`pinia-plugin-subscription`, then define a store with `defineAStore`.

```ts
import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, defineAStore } from 'pinia-plugin-subscription'
import { StateSnapshotsSubscriber } from 'pinia-plugin-state-snapshots'
import App from './App.vue'

const pinia = createPinia()
pinia.use(createPlugin([StateSnapshotsSubscriber]))

export const useCounterStore = defineAStore(
  'counter',
  () => {
    const count = ref(0)

    function incrementThenFail() {
      count.value++
      throw new Error('Action failed')
    }

    return { count, incrementThenFail }
  },
  {
    overrideReset: true,
    rollbackAfterFailure: {
      incrementThenFail: ['count'],
    },
  },
)

const app = createApp(App)
app.use(pinia)
app.mount('#app')
```

## Documentation

This plugin uses [`pinia-plugin-subscription`](https://github.com/AlxBDo/pinia-plugin-subscription)
to register its subscriber with Pinia.

### Reset behavior

The `$reset` wrapper is enabled when the subscriber's `overrideReset` property
or the store's `overrideReset` option is set. It captures the initial state
when the store is registered, then each call to `$reset()` patches the store
with a fresh deep clone of that captured state. If capturing the initial state
fails, the error is logged and the store's existing `$reset` method is left
unchanged.

Reset options:

| Option | Scope | Description |
| --- | --- | --- |
| `overrideReset` | `StateSnapshotsSubscriber` | Set to `true` to enable reset wrapping for every store registered with this subscriber. |
| `overrideReset` | Store options | Set to `true` to enable reset wrapping for one store. |

Reset wrapping is opt-in. If neither `overrideReset` setting is enabled, this
plugin leaves the store's existing `$reset` method unchanged. Registering a
callback does not enable reset wrapping by itself.

#### Reset callback examples

When the subscriber is installed, stores expose `$onResetStore(callback)`.
Register callbacks after obtaining the store; they run after a wrapped
`$reset()` restores the initial state and receive the store:

```ts
import { ref } from 'vue'

export const useCounterStore = defineAStore(
  'counter',
  () => {
    const count = ref(0)
    return { count }
  },
  {
    overrideReset: true,
  },
)

const counterStore = useCounterStore()
counterStore.$onResetStore?.((store) => {
  console.log('Counter store was reset', store)
})
```

Callbacks are kept per store and may be registered more than once. They are
only invoked when `StateSnapshotsSubscriber` has installed its `$reset`
wrapper through one of the `overrideReset` settings above.

### Automatic action rollback

Set `rollbackAfterFailure` in the store options to configure automatic
snapshots. Its keys are action names; each value is either `'all'` to capture
the full state or an array of state keys to capture. An empty key array also
selects the full state. Only the selected keys are restored on failure.

The plugin captures a separate snapshot at the start of each action invocation.
If that invocation succeeds, its snapshot is discarded; if it fails, its
snapshot is restored and the action's original error is propagated. Nested and
overlapping calls are tracked independently. A rollback restores the state as
it was when that invocation began; it does not merge changes made by other
actions while it was pending.

### Manual rollback

Registered stores also receive
`$rollbackAfterFailure({ action, stateKeys }, args?)`. `action` is the action
name; `stateKeys` uses the same `'all'` or key-array selection as automatic
rollback and defaults to the full state. Supply action arguments as a single
array in `args`. Manual rollback can invoke an action even if it has no
automatic rollback configuration. An invalid action name throws a `TypeError`.
The method resolves to `undefined` when the action succeeds and propagates the
action error if it fails.

### Snapshot support and limitations

Snapshots support primitives (except symbols), plain and null-prototype
objects, arrays, `Map`, `Set`, `Date`, and `URL`. Cycles and shared references
are preserved, and Vue proxies and refs are captured as values. Functions,
symbols, unsupported class instances and built-ins, accessors, non-enumerable
properties, symbol keys, and self-referential refs are not supported.

If snapshot creation fails (for example, because state contains an unsupported
value or a requested key is invalid), the plugin logs the error and still runs
the action without that rollback snapshot. The action's result or error is not
replaced by the snapshot-capture failure. A restoration failure is reported as
an `AggregateError` containing both the action error and restoration error;
restoration may have partially changed state. Restoring replaces selected
top-level values, so references held outside the store may continue pointing
to the old objects.

## Tests

The package is tested with [Vitest](https://vitest.dev/) as part of the parent
repository's test suite and continuous-integration workflow.

## Publishing

Releases are published to npm through the repository's
[GitHub Actions release workflow](https://github.com/AlxBDo/pinia-plugin-subscription/blob/main/.github/workflows/npm-publish.yml).
GitHub pre-releases use the npm `beta` tag; stable releases use `latest`.
Publishing uses npm provenance.

## License

[MIT](../../LICENSE)
