# Tracing

Tracing is the debugging solution of `pinia-plugin-subscription`, provided by the separate `pinia-plugin-subscription-devtools` package. The plugin only *emits* events through a `tracerHandler`; this package consumes them. Install it explicitly (usually as a development dependency): `npm install -D pinia-plugin-subscription-devtools`. It is **opt-in**, scoped to an explicit registry, and **allocation free when unused**.

Create a trace-groups registry per application or Pinia instance, add criteria to select the events to group, then pass its `tracerHandler` to `createPlugin()` so plugin and store events share its groups.

For SSR, create a fresh registry, Pinia instance, and plugin instance for every request; do not keep them in module-level state or clear a shared registry at request completion, since requests may overlap. See the [SSR guide](https://github.com/AlxBDo/pinia-plugin-subscription/blob/main/docs/using-plugins.md#ssr--nuxt) for an example.

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
- [Custom listeners](#custom-listeners)
- [Error reporting](#error-reporting)
- [Migrating from `debugLog()` / `logError()`](#migrating-from-debuglog--logerror)

## Quick start

```ts
import { createPlugin } from 'pinia-plugin-subscription'
import { createTracerRegistry } from 'pinia-plugin-subscription-devtools'

const traceGroupsRegistry = createTracerRegistry()
const remove = traceGroupsRegistry.addListener({
  filter: [
    { target: 'scope', value: 'cart' },
    { target: 'namespace', comparator: 'startsWith', value: 'pluginsubscription:subscription:' }
  ],
  handler: event => console.log(event.label, event.payload)
})

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

**Disabling normal tracing does not disable error reporting.** Errors can still be sent to `console.error` without a tracer or when no listener matches. See [Error reporting](#error-reporting) and the [security guidance](https://github.com/AlxBDo/pinia-plugin-subscription/blob/main/SECURITY.md#tracing-and-production-logging) for precautions, including log access and retention.

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

The default keys (`defaultRedactedKeys`, exported by this package) match, case-insensitively, any key containing `password`/`passwd`/`passphrase`/`passcode`, `secret`, `token`, `authorization`, `api key`, `private/encryption/signing key`, `credential`, `cookie` or `cipher`, or starting with `pwd`. Keys are masked at any depth, including inside arrays, `Map` and `Set`; circular references are handled. Redaction works on a copy, so the live store state is never modified, and it only runs when a listener consumes the event. If redaction itself fails, the payload is replaced by `{ __traceRedactionError }` rather than delivered raw.

Limits: only keys are inspected, not values (a secret stored under an innocuous key is not detected), `event.error` is not redacted, and nesting deeper than 12 levels is truncated.

## Filtering events

Criteria are evaluated against event metadata, before the payload is resolved. They can target the `source`, `namespace`, `scope` or `level` of an event.

By default, all criteria must match. Supported comparators are `equals` (the default), `contains`, `startsWith` and `endsWith`; set `filterMode` to `some` to match any criterion:

```ts
traceGroupsRegistry.addListener({
  filter: [
    { target: 'scope', value: 'cart' },
    { target: 'namespace', comparator: 'startsWith', value: 'pluginsubscription:subscription:' }
  ],
  handler: event => console.log(event.label)
}, { filterMode: 'every' })
```

Listener definitions passed to `addListener()` are never mutated.

Trace filters receive event metadata only. They never receive payloads or error objects. The built-in registry also avoids resolving payload factories when it has no registered listeners; custom `TracerHandler` implementations may expose the optional `hasTraceListeners()` capability to enable the same optimization.

For the common case of selecting several store scopes, use `addScopesListener(scopes, context?, handler?)`. It registers one listener that matches events whose `scope` equals **any** of the supplied strings and returns a remover just like `addListener()`. The optional `context` flag also matches the plugin's own context events and defaults to `true`:

```ts
const removeStoreListeners = traceGroupsRegistry.addScopesListener(
  ['cart', 'checkout'],
  false,
  event => console.log(event.label)
)

removeStoreListeners() // unsubscribe
```

Use `addListener()` when you need other metadata criteria or custom filter logic.

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

Events emitted for a store are grouped by lifecycle. A `groupId` is a `/` separated path whose prefixes are the parent groups, so `after` and `onError` are sub-groups of their `$onAction` call. The `traceGroups` helper, exported from `pinia-plugin-subscription/helpers`, builds these identifiers (`n` is the call counter):

| Builder | `groupId` | Lifecycle |
| --- | --- | --- |
| `traceGroups.plugin(id)` | `<id>/plugin` | Plugin setup and subscribers execution |
| `traceGroups.pluginDeferred(id, subscriber, n)` | `<id>/plugin/deferred:<subscriber>#<n>` | Deferred subscriber run |
| `traceGroups.onAction(id, name, n)` | `<id>/onAction:<name>#<n>` | One `$onAction` call |
| `traceGroups.onActionAfter(id, name, n)` | `<id>/onAction:<name>#<n>/after` | `after` callbacks of that call |
| `traceGroups.onActionError(id, name, n)` | `<id>/onAction:<name>#<n>/onError` | `onError` callbacks of that call |
| `traceGroups.onMutation(id, n)` | `<id>/onMutation#<n>` | `$subscribe` |
| `traceGroups.reset(id, n)` | `<id>/reset#<n>` | `$reset` |

You do not have to set a `groupId` yourself: while a group of a store is open, every trace emitted with that store as scope (subscribers, `Store` subclasses, custom tracers) joins the innermost open group. An explicit `groupId` in the payload wins, and is lifted to the event's `groupId` (like `actionId`), out of the payload. Listener handlers receive each event immediately and can use `groupId` to regroup them.

```ts
registry.addListener([{ target: 'groupId', comparator: 'startsWith', value: 'cart/onAction:' }])
```

`getTraceGroupName(groupId)` returns the readable name of a group (its last segment, without the counter). The plugin's action trace labels include the invoked action name (`store:onAction:<name>`).

Subscribers declared with `hydration: 'defer'` run after `plugin()` has closed its `PluginSubscription:context` group. Each deferred run opens its own sub-group of the plugin group (label `subscriber:deferred`, `groupId` `<id>/plugin/deferred:<subscriber>#<n>`); traces emitted by the subscriber during that run, such as those of a `Store` subclass, carry its `groupId`. The group stays open until asynchronous `hydrate()` / `afterHydration()` promises settle (fulfilled or rejected). A promise that never settles would keep the group open: after `deferredTraceGroupTimeout` milliseconds (plugin option, default `2500`) the group is closed anyway and a `subscriber:deferred:timeout` error is traced inside it.

## Journal

Listeners receive each event as it is emitted. The journal instead records **every** event of **every** store, matched by a listener or not, so that a store trace can be read back at any time (the basis of an in-page trace panel).

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
import { stringifyTraceSnapshot } from 'pinia-plugin-subscription-devtools'
const traces = stringifyTraceSnapshot(registry.journal?.serialize()) // HTML-safe JSON
// <script type="application/json" id="pinia-traces">${traces}</script>

// client
registry.journal?.import(JSON.parse(document.querySelector('#pinia-traces')!.textContent!))
```

Imported events are marked `side: 'server'`, ordered before the local ones, and replace any earlier import. Malformed entries are skipped and unknown fields are never copied.

> **Security**: a snapshot exposes server-side payloads to the browser. Only embed it in development (the journal is off in production builds by default) and enable `redact` if payloads may hold secrets. When using `replace()` to inject it into an HTML template, pass a replacer function so that `$` sequences are not interpreted.

## In-page trace panel

`mountTraceDevtools()` mounts an aside in the page that reads the journal: one selector per store, a **Timeline** (events nested by lifecycle, client and server interleaved, `P` / `E` chips on events carrying a payload / an error, expandable details, filters on text, side and level) and a **Context** tab (store, subscribers, hook subscriptions and options). It is isolated in a Shadow DOM, updates live, and renders text only.

For the simplest browser development setup, use `createTraceDevtools()`:

```ts
import { createPlugin } from 'pinia-plugin-subscription'
import { createTraceDevtools } from 'pinia-plugin-subscription-devtools'

const { registry } = createTraceDevtools()
pinia.use(createPlugin(subscribers, { tracerHandler: registry.tracerHandler }))
```

It creates a journal-backed registry whose payloads are redacted with the default keys, and mounts the panel without registering console listeners. An SSR journal snapshot in a `<script type="application/json" id="pinia-traces">` element is imported automatically; set `serverSnapshotId` to a different element ID or `false` to disable importing it. Normal trace events appear in the panel, not the console; the `console.error` fallback for unmatched error events still applies. Nothing is mounted outside the browser or in production builds. Pass panel options to customize it, for example `createTraceDevtools({ open: true })`; it returns `{ registry, handle }`, `handle` being the `mountTraceDevtools()` handle.

`createTraceDevtools()` is meant for development. To keep the package out of production bundles, load it with a dynamic import behind a development check. For custom trace listeners, server-side trace transfer, or other registry options, use the manual setup below.

```ts
import { createTracerRegistry } from 'pinia-plugin-subscription-devtools'

const registry = createTracerRegistry({ journal: true })
// ...pinia.use(createPlugin(subscribers, { tracerHandler: registry.tracerHandler }))

if (import.meta.env.DEV) {
    import('pinia-plugin-subscription-devtools').then(({ mountTraceDevtools }) => mountTraceDevtools(registry))
}
```

| Option | Default | Description |
| --- | --- | --- |
| `open` | `false` | Open the panel on mount (a floating `Devtools` button otherwise) |
| `position` | `right` | `left` or `right` |
| `width` | `480` | Aside width in pixels |
| `shortcut` | `Alt+Shift+P` | Toggle shortcut, `false` to disable |
| `container` | `document.body` | Element the panel host is appended to |

`mountTraceDevtools` returns `{ open, close, toggle, unmount }`. It does nothing outside a browser or without a journal. The panel uses `vue` (a peer dependency). The Context tab shows the store objects as they are when first opened.

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

## Custom listeners

The package no longer prints traces to the console: events are delivered to the `handler` of each matching listener, and the [in-page panel](#in-page-trace-panel) displays them. Pass a `handler` (and optionally a custom `filter` function) to forward events wherever you need, such as the console, a logging service or a test collector:

```ts
registry.addListener({
  filter: event => event.scope === 'cart' && event.level === 'debug', // metadata only
  handler: event => console.log(event.label, event.payload)           // resolved (and redacted) event
})
```

`handler` is optional when a listener is only used to keep tracing active; criteria arrays can be used as `filter` too, and `addScopesListener(scopes, context?, handler?)` accepts a handler as its third argument. Events carry their `groupId`, `actionId` and `scope`, so a handler can reproduce any grouping it needs; it is called once per event, immediately.

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
