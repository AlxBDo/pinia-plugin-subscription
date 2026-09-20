# pinia-plugin-subscription

Pinia plugin for Vue.js that helps building Pinia plugins by centralizing subscriber registration and providing a `Store` base class for store helpers.

This project provides:
- a lightweight mechanism to declare "subscribers" that are invoked when stores are registered or updated by Pinia;
- a `Store` base class (helper wrapper) to ease interacting with Pinia stores from subscribers or other plugin code;
- an API to create a Pinia plugin from a list of subscribers;
- the `$reset` method on all stores modified by the plugin;
- automatic state rollback on action failure via the `rollbackAfterFailure` store option and the `$rollbackAfterFailure` method.

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
| Build your own pinia plugin on top of `pinia-plugin-subscription` | [Plugin authoring guide](docs/authoring-plugins.md) |

## Installation

```bash
npm install pinia pinia-plugin-subscription
```

Register the plugin in your `main.ts`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPlugin, PLUGIN_NAME } from 'pinia-plugin-subscription'
import { myStoreSubscriber } from './plugins/my-store'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Register plugin (subscribers array, plugins to debug)
pinia.use(createPlugin([myStoreSubscriber], [PLUGIN_NAME]))

app.use(pinia)
app.mount('#app')
```

### Import subpaths

For helper-only imports, the package exposes an additive subpath kept separate from the default library API:

```ts
import { PluginSubscriber, Store } from 'pinia-plugin-subscription/helpers'
```

For type-only imports, prefer the dedicated public types entry:

```ts
import type { PluginSubscriptionOptions } from 'pinia-plugin-subscription/types'
```

## Development

- `npm run dev` — runs the dedicated demo app. The library build remains `npm run build` and is intentionally kept separate from the demo entry. The demo ships a complete plugin-authoring example in [`src/demo/extending-pinia-store/`](src/demo/extending-pinia-store/).
- `npm test` — runs the Vitest suite, including typecheck tests (`*.test-d.ts`) validating type-level contracts such as `StoreOptionsExtensions` merging. Coverage reports are available in `coverage/`.
- `npm run bundle:check` — measures the emitted bundle size.

## License

MIT

## Publishing

Releases are published to npm via GitHub Actions. GitHub releases marked as pre-releases are published with the `beta` dist-tag using `npm publish --tag beta`; stable releases use the default `latest` tag. The workflow uses npm provenance for better supply-chain security and requires a `NPM_TOKEN` secret in the repository settings.
