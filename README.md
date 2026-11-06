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
| Build your own pinia plugin on top of `pinia-plugin-subscription` (API reference, `Store` class, import subpaths, development and testing) | [Plugin authoring guide](docs/authoring-plugins.md) |
| Debug stores and plugins with structured trace events | [Tracing](packages/devtools/docs/tracing.md) |

A runnable example lives in [`demo/`](demo/) (`npm run dev` for SPA mode or `npm run dev:ssr` for Vite SSR). The SSR example hydrates **one store from two environments**: a server-only subscriber loads request data (awaited before rendering and serializing Pinia state) and a client-only, deferred subscriber fills browser data after hydration, with a visual timeline; see the [reference implementation](docs/authoring-plugins.md#reference-implementation). Plugins built on this package are discoverable through the [`pinia-plugin-subscription` GitHub topic](https://github.com/topics/pinia-plugin-subscription).

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

## Advanced Features

- **Structured tracing:** the plugin and `Store` emit typed trace events through an optional `tracerHandler`. Tracing itself (listeners, journal, redaction, in-page panel) lives in the separate [`pinia-plugin-subscription-devtools`](packages/devtools/) package, so apps that do not debug stay lean — see [Tracing](#tracing).
- **Reset callbacks:** Define `resetStoreCallback` to run custom logic when a store is reset.
- **SSR and hydration control:** Configure whether each subscribed plugin runs on the server, the client, or only after client hydration.
- **Lifecycle safety:** Internal hydration ordering is now guarded so `hydrate()` completes before `afterHydration()` and disposed stores do not retain stale subscriber metadata.

## Tracing

The plugin only *emits* structured trace events; without a `tracerHandler` it emits nothing and costs nothing. Install [`pinia-plugin-subscription-devtools`](packages/devtools/) (usually as a development dependency) to consume them with filtered listeners, a per-store journal, payload redaction and an in-page panel.

## License

MIT

## Publishing

Both packages (`pinia-plugin-subscription` and `pinia-plugin-subscription-devtools`) are published to npm via GitHub Actions on the same release. GitHub releases marked as pre-releases are published with the `beta` dist-tag; stable releases use the default `latest` tag. The workflow runs `scripts/publish-unpublished.mjs`, which skips any package whose version is already on npm, so it can be safely re-run after a partial failure. It uses npm provenance for better supply-chain security and requires a `NPM_TOKEN` secret in the repository settings.
