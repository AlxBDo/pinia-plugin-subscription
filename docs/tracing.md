# Tracing

Tracing is the debugging solution of `pinia-plugin-subscription`. It is **opt-in**, scoped to an explicit registry, and **allocation free when unused**.

Create a trace-groups registry per application or Pinia instance, add criteria to select the events to group, then pass its `tracerHandler` to `createPlugin()` so plugin and store events share its groups.

For SSR, create a fresh registry, Pinia instance, and plugin instance for every request; do not keep them in module-level state or clear a shared registry at request completion, since requests may overlap. See the [SSR guide](./using-plugins.md#ssr--nuxt) for an example.

## Contents

- [Quick start](#quick-start)
- [Production safety](#production-safety)
- [Redaction](#redaction)
- [Filtering events](#filtering-events)
- [Event shape](#event-shape)
- [Journal](#journal)
- [Server traces in the browser](#server-traces-in-the-browser)
- [In-page trace panel](#in-page-trace-panel)
- [Emitting your own events](#emitting-your-own-events)
- [Grouped console output](#grouped-console-output)
- [Error reporting](#error-reporting)
- [Migrating from `debugLog()` / `logError()`](#migrating-from-debuglog--logerror)

## Quick start

```ts
import { createPlugin } from 'pinia-plugin-subscription'
import { createTracerRegistry } from 'pinia-plugin-subscription/helpers'

const traceGroupsRegistry = createTracerRegistry()
const remove = traceGroupsRegistry.addListener([
  { target: 'scope', value: 'cart' },
  { target: 'namespace', comparator: 'startsWith', value: 'pluginsubscription:subscription:' }
])

pinia.use(createPlugin(subscribers, {
  tracerHandler: traceGroupsRegistry.tracerHandler
}))

remove() // unsubscribe
```

`createTracerRegistry(options?)` accepts:

| Option | Description |
| --- | --- |
| `enabled` | Whether listeners can be registered. Defaults to `false` in production builds, `true` otherwise. See [Production safety](#production-safety). |
| `redact` | Masks sensitive payload values before they reach listeners. `true` uses the default keys; an object customizes them. See [Redaction](#redaction). |

## Production safety

Tracing is **disabled by default in production builds**: `createTracerRegistry()` ignores `addListener()` when `process.env.NODE_ENV === 'production'` (statically replaced by Vite, webpack and Nuxt in the consuming application), so no listener — and therefore no console output — is active. Pass `createTracerRegistry({ enabled: true })` to enable production diagnostics deliberately, with limited scope and duration; `enabled: false` forces tracing off in any environment. When no bundler replaces `process.env.NODE_ENV`, tracing is considered enabled.

Events are **not redacted by default** and may include sensitive action arguments, store state, plugin options, or error details. Filters select events by metadata; they do not sanitize payloads. Enable the built-in [redaction](#redaction) and, before writing to a console or forwarding to a logging service, select an allowlist of fields rather than sending complete events.

**Disabling normal tracing does not disable error reporting.** Errors can still be sent to `console.error` without a tracer or when no listener matches. See [Error reporting](#error-reporting) and the [security guidance](../SECURITY.md#tracing-and-production-logging) for precautions, including log access and retention.

## Redaction

Pass `redact` to `createTracerRegistry()` to mask sensitive values in event payloads **before** they reach any listener, including custom ones:

```ts
const registry = createTracerRegistry({ redact: true }) // default keys

const custom = createTracerRegistry({
  redact: {
    keys: ['iban', /^ssn/i],   // added to the defaults: strings match exactly (case-insensitive), regexps match anywhere in the key
    includeDefaults: true,     // set to false to use only `keys`
    replacement: '***'         // default: '[REDACTED]'
  }
})
```

The default keys (`defaultRedactedKeys`, exported from `pinia-plugin-subscription/helpers`) match, case-insensitively, any key containing `password`/`passwd`/`passphrase`/`passcode`, `secret`, `token`, `authorization`, `api key`, `private/encryption/signing key`, `credential`, `cookie` or `cipher`, or starting with `pwd`. Keys are masked at any depth, including inside arrays, `Map` and `Set`; circular references are handled. Redaction works on a copy, so the live store state is never modified, and it only runs when a listener consumes the event. If redaction itself fails, the payload is replaced by `{ __traceRedactionError }` rather than delivered raw.

Limits: only keys are inspected, not values (a secret stored under an innocuous key is not detected), `event.error` is not redacted, and nesting deeper than 12 levels is truncated.

## Filtering events

Criteria are evaluated against event metadata, before the payload is resolved. They can target the `source`, `namespace`, `scope` or `level` of an event.

By default, all criteria must match and events are grouped by `scope`. Supported comparators are `equals` (the default), `contains`, `startsWith` and `endsWith`; set `filterMode` to `some` to match any criterion, or `groupBy` to group by a different event metadata field:

```ts
traceGroupsRegistry.addListener([
  { target: 'scope', value: 'cart' },
  { target: 'namespace', comparator: 'startsWith', value: 'pluginsubscription:subscription:' }
], { filterMode: 'every', groupBy: 'scope' })
```

Listener definitions passed to `addListener()` are never mutated.

Trace filters, including custom filters used when starting or closing groups, receive event metadata only. They never receive payloads or error objects. The built-in registry also avoids resolving group payload factories when it has no registered listeners; custom `TracerHandler` implementations may expose the optional `hasTraceListeners()` capability to enable the same optimization.

For the common case of selecting several store scopes, use `addScopesListener(scopes, context?)`. It registers one listener that matches events whose `scope` equals **any** of the supplied strings, groups them by scope, and returns a remover just like `addListener()`. The optional `context` flag controls whether the plugin context is printed and defaults to `true`:

```ts
const removeStoreListeners = traceGroupsRegistry.addScopesListener(
  ['cart', 'checkout'],
  false
)

removeStoreListeners() // unsubscribe
```

Use `addListener()` when you need other metadata criteria, a different grouping field, or custom filter logic.

## Event shape

| Field | Description |
| --- | --- |
| `namespace` | Structured identifier, derived from the label by default |
| `label` | Human-readable event label |
| `source` | Source passed to `createTracer`, usually `pinia-plugin-subscription` |
| `scope` | Instance identifier, usually `store.$id` |
| `payload` | Event data, resolved only when consumed |
| `level` | `debug` or `error` |
| `actionId` | Shared by every event of one store action (`<storeId>#<n>`), when emitted by an action |
| `seq` | Monotonic position in the registry. Journal only |
| `side` | `client` or `server`. Journal only |
| `timestamp` | `Date.now()` at emission |
| `error` | Present on `error` events |

By default, `Store` prefixes its class name to labels and derived namespaces. Library events use `PluginSubscription` as their prefix (for example, `pluginsubscription:store:mutation` and `pluginsubscription:subscription:delivery`). Set `classNameAddedToTraceNamespace = false` on a `Store` subclass to omit its class prefix, or provide an explicit namespace as the fourth argument to `trace()` / `traceError()`.

## Trace groups glossary

Events emitted within the same hook for the same store share a `groupId`. The `traceGroups` helper, exported from `pinia-plugin-subscription/helpers`, builds these identifiers from a store ID:

| Builder | `groupId` | Hook |
| --- | --- | --- |
| `traceGroups.onActionAfter(id)` | `store:onAction:after:<id>` | `$onAction` `after` |
| `traceGroups.onActionError(id)` | `store:onAction:onError:<id>` | `$onAction` `onError` |
| `traceGroups.onMutation(id)` | `store:onMutation:<id>` | `$subscribe` |
| `traceGroups.reset(id)` | `store:reset:<id>` | `$reset` |

```ts
import { traceGroups } from 'pinia-plugin-subscription/helpers'

registry.addListener([{ target: 'groupId', value: traceGroups.onActionAfter('cart') }])
```

The plugin's action trace labels include the invoked action name (`store:onAction:<name>`). The `after` and `onError` callback trace labels also include that name, making activity from different actions distinguishable; their group IDs remain scoped to the store as shown above.

Subscribers declared with `hydration: 'defer'` run after `plugin()` has closed its `PluginSubscription:context` group. Each deferred run opens its own group (label `subscriber:deferred`, no `groupId`, so it is keyed by the store scope like the `context` group); traces emitted by the subscriber during that run, such as those of a `Store` subclass, are printed inside it. The group stays open until asynchronous `hydrate()` / `afterHydration()` promises settle (fulfilled or rejected). While it is open, console listeners buffer every trace of that store scope, so a promise that never settles would hide them: after `deferredTraceGroupTimeout` milliseconds (plugin option, default `2500`) the group is closed anyway and a `subscriber:deferred:timeout` error is traced inside it.

## Journal

Console listeners print and forget. The journal instead records **every** event of **every** store, matched by a listener or not, so that a store trace can be read back at any time (the basis of an in-page trace panel).

```ts
const registry = createTracerRegistry({ journal: { maxEventsPerStore: 1000 } })

registry.journal?.getScopes()        // ['cart', 'user']
registry.journal?.getEvents('cart')  // ordered by `seq`, with `actionId` and `side`
registry.journal?.getDropped('cart') // events evicted by the size cap
registry.journal?.subscribe(event => { /* live updates */ })
```

- Opt-in: `registry.journal` is `undefined` unless `journal` is `true` or an options object, or when tracing is disabled (`enabled: false`, production builds).
- Size cap: `maxEventsPerStore` (default `1000`) applies per store and per side; the oldest events are evicted first. Context and error events are kept in their own buffer under the same cap, and `side: 'server'` events do not compete with client ones.
- `side` defaults to `server` when `window` is undefined, `client` otherwise; override it with the `side` option.
- Events are stored by reference, after redaction when `redact` is enabled: use `redact` if payloads may hold secrets.
- Create one registry (hence one journal) per request on the server.

## Server traces in the browser

`journal.serialize()` returns a JSON-safe, size-bounded snapshot (payloads go through `toSerializable`: circular references, functions and `_`-prefixed internals are handled, error stacks are dropped). Embed it in the page next to the Pinia state, then `import()` it on the client:

```ts
// server, after rendering (one registry per request)
import { stringifyTraceSnapshot } from 'pinia-plugin-subscription/helpers'
const traces = stringifyTraceSnapshot(registry.journal?.serialize()) // HTML-safe JSON
// <script type="application/json" id="pinia-traces">${traces}</script>

// client
registry.journal?.import(JSON.parse(document.querySelector('#pinia-traces')!.textContent!))
```

Imported events are marked `side: 'server'`, ordered before the local ones, and replace any earlier import. Malformed entries are skipped and unknown fields are never copied.

> **Security**: a snapshot exposes server-side payloads to the browser. Only embed it in development (the journal is off in production builds by default) and enable `redact` if payloads may hold secrets. When using `replace()` to inject it into an HTML template, pass a replacer function so that `$` sequences are not interpreted.

## In-page trace panel

`pinia-plugin-subscription/devtools` mounts an aside in the page that reads the journal: one selector per store, a **Timeline** (events grouped by action, client and server interleaved, expandable payloads, filters on text, side and level) and a **Context** tab (store, subscribers, hook subscriptions and options). It is isolated in a Shadow DOM, updates live, and renders text only.

```ts
const registry = createTracerRegistry({ journal: true })
// ...pinia.use(createPlugin(subscribers, { tracerHandler: registry.tracerHandler }))

if (import.meta.env.DEV) {
    import('pinia-plugin-subscription/devtools').then(({ mountTraceDevtools }) => mountTraceDevtools(registry))
}
```

| Option | Default | Description |
| --- | --- | --- |
| `open` | `false` | Open the panel on mount (a floating `PPS` button otherwise) |
| `position` | `right` | `left` or `right` |
| `width` | `480` | Aside width in pixels |
| `shortcut` | `Alt+Shift+P` | Toggle shortcut, `false` to disable |
| `container` | `document.body` | Element the panel host is appended to |

`mountTraceDevtools` returns `{ open, close, toggle, unmount }`. It does nothing outside a browser or without a journal. The panel uses `vue` (already a peer dependency); keep it out of production bundles with a dynamic import. The Context tab shows the store objects as they are when first opened.

## Emitting your own events

```ts
class CartStore extends Store {
  hydrate() {
    this.trace('cart:hydrate', this.store.$id, () => ({ items: this.state.items }))
  }
}
```

`trace(label, scope?, payload?, namespace?)` and `traceError(label, error, scope?, payload?, namespace?)` are provided by the abstract `TraceEmitter` class, shared by `Store` and `PluginSubscription`. The scope defaults to the store ID for `Store`. The class name is included in the label by default; unless an explicit namespace is provided, the normalized label is used as the namespace.

Always prefer the **function form** for `payload`: it is only invoked once a listener matches, so unobserved tracing costs nothing.

Trace groups opened by `onAction`, `$subscribe` and `$reset` are always closed, including when the action fails or a callback throws.

## Grouped console output

Normal trace events do not write to a console. The registry created by `createTracerRegistry()` uses the console's grouped output for the events matching its listeners: register listeners as shown in the [quick start](#quick-start) and pass `tracerHandler` to the plugin. Groups default to the `scope` metadata field; use the `groupBy` option of `addListener()` to group by another field.

When an event has a `payload.groupId`, that value takes precedence over the configured `groupBy` field as its console-group key. Events without an open group for their key are printed immediately outside a group. If multiple groups with the same key are opened concurrently, their events share one buffer; the buffered group is printed only after every matching open has been closed.

`CustomConsole` remains exported from `pinia-plugin-subscription/helpers` for plugins not yet migrated to the tracer.

## Error reporting

An error is delivered to every matching listener. If no listener matches — including when listeners exist but all filters reject the event — it is reported with `console.error`; it is not rethrown. Errors thrown by filters or handlers are also reported and isolated so they do not interrupt the traced process or remaining listeners.

`registry.clearTraceListeners()` empties the shared listener list in place: tracers created earlier stop delivering to the cleared listeners and see listeners registered afterwards.

## Migrating from `debugLog()` / `logError()`

These methods were removed in favour of structured events:

```ts
// before
this.debugLog(`$subscribe ${store.$id}`, { mutation, store })
this.logError('subscriptionDelivery()', error, store, options)

// after
this.trace('store:mutation', store.$id, () => ({ mutation, store }))
this.traceError('subscription:delivery', error, store.$id, () => ({ store, options }))
```

The `namespace` replaces the formatted message, and the payload becomes a factory so it is only built when a listener consumes the event.
