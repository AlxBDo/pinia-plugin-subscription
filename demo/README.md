# Demo

Runnable Vite example of a plugin built on `pinia-plugin-subscription`.

```bash
npm run dev       # client-rendered SPA
npm run dev:ssr   # Vue SSR with client hydration
```

Both modes resolve `pinia-plugin-subscription` and `pinia-plugin-subscription-devtools` to the sources in `src/` and `packages/devtools/src/` (see `vite.demo.config.ts`): no build is required and edits are hot-reloaded. In SSR mode, every request creates a fresh Vue app, Pinia instance, tracer registry, and demo subscribers. A server-only subscriber asynchronously prepares request data (language from the `Accept-Language` header, path, render time); the server waits for its `hydrate()` hook before rendering and serializing Pinia state. A client-only subscriber with `hydration: 'defer'` then fills browser-only data (time zone, viewport, color scheme) after hydration. Both target the same store, and the plugin skips each one in the other environment; a timeline in the page shows which environment performed each step. The in-memory loader stands in for a request-scoped database or API call. The client traces are shown in the in-page panel (`Alt+Shift+P`); in SSR mode the server traces are embedded in the page and appear in the same panel.

| Use case | Files | Documentation |
| --- | --- | --- |
| Class-based plugin (`PluginSubscriber` + `Store`) | `plugins/DemoPluginClass.ts`, `core/DemoStore.ts` | [Authoring plugins](../docs/authoring-plugins.md) |
| Plain-object plugin (`createPluginSubscriber`) | `plugins/demoPluginObject.ts` | [Authoring plugins](../docs/authoring-plugins.md#your-first-subscriber-a-plain-object) |
| Environment-aware hydration (server + browser on one store) | `plugins/demoPluginEnvironmentHydration.ts`, `core/VisitorEnvironmentStore.ts`, `stores/visitor-environment.ts`, `components/HydrationEnvironmentExample.vue`, `entry-server.ts` | [Execution policy & SSR](../docs/authoring-plugins.md#execution-policy--ssr) |
| Typed plugin options | `types/plugin.ts` | [Authoring plugins](../docs/authoring-plugins.md) |
| State rollback (`rollbackAfterFailure`, `$rollbackAfterFailure`) | `stores/rollback-snapshot.ts`, `components/Example.vue` | [Using plugins](../docs/using-plugins.md#state-rollback-on-action-failure) |
| Plugin-enhanced store (`defineAStoreCtx`) | `stores/enhanced-store.ts`, `components/EnhancedExample.vue` | [Using plugins](../docs/using-plugins.md#using-plugin-added-features-at-definition-time-defineastorectx) |
| Registration and tracing | `main.ts` | [Tracing](../docs/tracing.md) |

Files under `**/experiment` are local scratch space and are git-ignored.
