# pinia-plugin-subscription-devtools

Debugging tools for [`pinia-plugin-subscription`](https://github.com/AlxBDo/pinia-plugin-subscription) and the Pinia plugins built on it: a trace registry with filtered listeners, a per-store journal, payload redaction and an in-page trace panel.

`pinia-plugin-subscription` only *emits* structured trace events. Install this package, usually as a development dependency, to consume them. It is never installed or loaded automatically.

## Installation

```bash
npm install -D pinia-plugin-subscription-devtools
```

Peer dependencies: `pinia-plugin-subscription` and `vue` (3.x).

## Quick start

```ts
import { createPlugin } from 'pinia-plugin-subscription'
import { createTraceDevtools } from 'pinia-plugin-subscription-devtools'

const { registry } = createTraceDevtools()

pinia.use(createPlugin(subscribers, { tracerHandler: registry.tracerHandler }))
```

In a development browser, `createTraceDevtools()` mounts the in-page panel (`Alt+Shift+P`). Nothing is mounted on the server or in production builds. To keep the package out of production bundles, load it with a dynamic import behind a development check.

For custom listeners, filtering, redaction, the journal, SSR traces and error reporting, use `createTracerRegistry()` and see the [Tracing documentation](./docs/tracing.md).

## Exports

| Export | Purpose |
| --- | --- |
| `createTraceDevtools(options?)` | Journal registry with redacted payloads, SSR snapshot import and the in-page panel |
| `createTracerRegistry(options?)` | Registry of listeners, journal and `tracerHandler` for `createPlugin()` |
| `mountTraceDevtools(registry, options?)` | Mounts the in-page panel on a registry with a journal |
| `Tracer` | Class emitting events, created by the registry |
| `stringifyTraceSnapshot(snapshot)` | HTML-safe JSON of a journal snapshot, to carry server traces to the browser |
| `defaultRedactedKeys`, `getTraceGroupName` | Redaction keys and group naming helpers |

## License

MIT
