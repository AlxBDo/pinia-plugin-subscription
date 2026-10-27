# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `storeMutationSubscription` now supports several subscribers per store, like `storeOnActionSubscription`: a single `$subscribe` is registered per store and dispatches to every callback. A failing callback is reported through `traceError` without blocking the others, subscriber names are tracked, and the hook is unsubscribed when the store is disposed
- `storeOnActionSubscription` now receives the Pinia plugin context; action trace labels include the invoked action name

### Added
- Added `addScopesListener(scopes, context?)` to `createTracerRegistry()` for grouping events from selected store scopes; documented in `docs/tracing.md`
- `traceGroups` glossary, exported from `pinia-plugin-subscription/helpers`, building the `groupId` emitted by `PluginSubscription` (`onActionAfter`, `onActionError`, `onMutation`, `reset`); documented in `docs/tracing.md`
- `createPluginSubscriber(name, invoke, optionalProps?)` factory, exported from `pinia-plugin-subscription/helpers`, to build plain-object subscribers; documented in `docs/authoring-plugins.md` and used by the demo plugin
- Added a dedicated tracing guide, `docs/tracing.md`; the README now only presents tracing and links to it
- Moved the API reference, import subpaths, development, `Store` summary and testing sections from `README.md` to `docs/authoring-plugins.md`
- `createTracerRegistry({ redact })`: opt-in redaction of event payloads before they reach listeners. `true` masks a default list of sensitive keys (`password`, `token`, `secret`, `authorization`, API/private keys, `credential`, `cookie`, `cipher`...); an object adds custom `keys`, a `replacement`, or drops the defaults with `includeDefaults: false`. It works on a copy, covers arrays/`Map`/`Set`, handles circular references, and replaces the payload by `__traceRedactionError` if redaction fails. `defaultRedactedKeys` and `TraceRedactOptions` are exported
- `createTracerRegistry({ enabled })`: tracing is now disabled by default in production builds (`process.env.NODE_ENV === 'production'`); `addListener()` becomes a no-op unless `enabled: true` is passed. `enabled: false` forces it off in any environment. Error reporting through `console.error` is unchanged
- Added `createTracerRegistry()` to create isolated trace listeners and tracers for each application or Pinia instance
- Added `createTracerRegistry()` to group matching trace events in the console
- Added the `Tracer` class and registry methods `addTraceListener()`, `clearTraceListeners()` and `hasTraceListeners()`
- Added metadata-based trace filter criteria with `equals`, `contains`, `startsWith` and `endsWith` comparators, combined with `every` or `some`
- Added `createConsoleTraceListener()` as an opt-in console sink for trace events
- Added `trace()` and `traceError()` to `Store` and `PluginSubscription`
- Added trace types: `TraceEvent`, `TraceEventMetadata`, `TraceFilter`, `TraceHandler`, `TraceLevel`, `TraceListener`, `TraceListenerRemover`, `TracePayload`, `TracerOptions`
- Added `check:leaks` script and `scripts/check-dist-leaks.mjs`, guarding published artifacts against non-peer dependency imports in `dist/` (`.js` and `.d.ts`)
- Added the leak guard to `npm run build` and to the CI workflow
- Added unit tests covering the tracing system and the leak detection logic

### Changed
- Moved the demo application from `src/demo/` to the repository-level `demo/` directory, separating example code from the library source and tracking the demo files in version control.
- Clarified that SSR tracing registries and plugin instances must be created per request, and added coverage for listener isolation between registries
- Replaced the `Debug` abstract class with composition: `Store` and `PluginSubscription` no longer extend it and now own a `Tracer`
- `createPlugin()` accepts `PluginSubscriptionOptions`, including a `createTracer` factory to connect a tracer registry to plugin and store trace events
- Trace errors with no matching listener, and failures in listener filters or handlers, are now reported with `console.error` instead of rethrowing the original error
- Deprecated `createHydrationPlugin()` in favor of `createPlugin()` with hydration options
- Trace payloads are now lazily resolved, so unobserved tracing no longer builds log arguments
- Internal events now derive namespaces from trace labels, with `PluginSubscription` prefixed by default; store events carry `store.$id` as `scope`
- `Tracer` now delegates all output decisions to listeners and no longer owns a console or an enabled state
- Error events are delivered to matching listeners and reported with `console.error` when none match
- Store trace labels can include the store class name by default, and callers can override the event namespace
- Excluded `scripts/**` from coverage thresholds, as build tooling is not shipped to consumers
- `Store` and `PluginSubscription` now share the abstract `TraceEmitter` class for `trace()`, `traceError()` and class-name label formatting, removing duplicated code
- `Tracer` listener matching no longer allocates intermediate arrays beyond the matched set, and duplicated unhandled-error reporting was factored out
- The `pluginsubscription` namespace prefix is now a shared constant (`pluginSubscriptionNamespace`) instead of a hard-coded string

### Fixed
- `onAction`, `after` and `onError` subscription callbacks may now be asynchronous: rejections are traced instead of becoming unhandled, and their trace groups are closed once all async callbacks have settled
- Group listener filters receive only trace metadata, redaction safely copies own `__proto__` keys, and registry group payload factories are skipped when no listeners are registered
- Subscriber, subscription, action and rollback tracking keys now encode store IDs and names without delimiter collisions; disposing a store removes only its own tracking entries
- Trace groups opened by `onAction`, `$subscribe` and `$reset` are now always closed (also when the action fails or a callback throws), so grouped events no longer stay buffered forever
- Listener definitions passed to `addListener()` are no longer mutated when their `filter` is an array of criteria
- `TracerHandler` and `TraceRegistry` types now match the implementation (`createTracer(source, options?)`, `void` group callbacks, `addListener()` with options, `tracerHandler`); `createTracerRegistry()` is explicitly typed as `TraceRegistry`
- `CustomConsole.rebuildArgs()` no longer returns `undefined` for unsupported argument types
- `clearTraceListeners()` now empties the shared listener list in place, so tracers created before the call stop delivering to cleared listeners and see listeners registered afterwards

### Removed
- Removed the internal `PluginConsole` singleton and the dead commented code of `system/log.ts`; `CustomConsole` stays exported from `helpers` for plugins not yet migrated to the tracer
- **Breaking:** removed `debugLog()` and `logError()` from `Store` and `PluginSubscription` — use `trace()` and `traceError()` instead (see the migration snippet in `docs/tracing.md`)
- **Breaking:** removed the obsolete `debug` and custom-console arguments from `createPlugin()`, `PluginSubscription`, `PluginSubscriber`, `Store`, and `Store.customizeStore()`
- **Breaking:** removed the `debug` argument from subscriber `invoke()`, `hydrate()`, and `afterHydration()` hooks; tracing is now configured exclusively through listeners
- **Breaking:** removed the legacy `debug` and `console` accessors from `Store` and `PluginSubscription`
- Removed the internal `src/system/Debug.ts` abstract class (was never publicly exported)
- **Breaking:** replaced module-global trace-listener functions with methods on a `createTracerRegistry()` instance

## [0.2.1]

### Fixed
- Kept deferred action subscribers attached to the correct store after hydration, and scoped action/reset callbacks to each store so disposal and recreation do not leak callbacks.
- Preserved existing refs with falsy values when adding setup-store state.
- Made `stateKeys: []` restore the full state in both explicit and automatic rollback.

## [0.2.0]

### Added
- Added `StoreOptionsExtensions`, a centralized extension point for per-store plugin options: subscriber plugins can now type their own `storeOptions` keys through interface merging (`declare module 'pinia-plugin-subscription/types'`) instead of redeclaring pinia's `DefineStoreOptionsBase`, which would raise TS2717 type-conflict errors in consumer projects.
- Enabled Vitest typecheck tests (`*.test-d.ts`) so the `StoreOptionsExtensions` merging contract is validated at compile time alongside the runtime test suite.
- Added `docs/using-plugins.md`, a consumer-oriented guide: plugin registration, `defineAStore` / `defineAStoreCtx` reference (including TypeScript generics with JavaScript-first examples), `$reset`, state rollback, and SSR / Nuxt registration through `createHydrationPlugin`.
- Added `docs/authoring-plugins.md`, a plugin-author guide: `PluginSubscriberInterface` reference, the `PluginSubscriber` abstract class (including its `Instance` type parameter), the `Store` base class, execution policy & SSR best practices, and `StoreOptionsExtensions` augmentation.
- Documented the testing setup and the trust & supply-chain practices (GPG-signed commits, review-gated merges, npm provenance) in the README.

### Changed
- Restructured the documentation around the package's two audiences: the README is now a lightweight entry point that routes readers to the dedicated consumer and plugin-author guides.
- Added the `docs/` directory to the published package files so both guides ship with the npm tarball.

### Fixed
- Aligned the `$rollbackAfterFailure` public type with its implementation: action arguments are now passed as a single array (`$rollbackAfterFailure(params, [arg1, arg2])`, forwarded via `apply()`), instead of the documented variadic form that threw `TypeError: CreateListFromArrayLike called on non-object` at runtime.
- Fixed store typings lost when defining stores with `defineAStore`, `defineAStoreCtx`, `defineAStoreSetup` or `defineAStoreOptionApi`: state, getters and actions are now inferred from the store definition (setup function return or options object), exactly like pinia's `defineStore`, so IDEs list store members and display action prototypes. Explicit store/state generics (e.g. `defineAStore<Sto, Sta>`) remain supported for plugin-augmented stores and now type the store returned by `useStore()` — they were previously intersected onto the store definition itself, which left the returned store loosely typed.
- Added the public `DefineAStoreDefinition<Sto, Sta>` type: the store definition returned when explicit store/state generics are provided. It extends pinia's `StoreDefinition` so it stays assignable wherever a standard store definition is expected.
- Widened the `getDefineAStoreSetupContext` parameter to accept any store object, so fully inferred stores (without index signatures) can be passed without a cast.
- Fixed stores defined with explicit generics (`defineAStore<Sto, Sta>` / `defineAStoreCtx<Sto, Sta>`) exposing every non-state member as `any`: the state was intersected with pinia's `StateTree`, whose `any` index signature widened actions and broke IDE autocompletion. The state is now mapped through the new public `StrictStateTree<Sta>` type.

## [0.2.0-beta.0]

### Added
- Added automatic state rollback on action failure via the `rollbackAfterFailure` store option: the declared state keys are snapshotted before the action runs and restored through `$patch` when the action throws (sync or async).
- Added `$rollbackAfterFailure(params, ...args)` to `PiniaCustomProperties`, available on every store registered by the plugin, to run an action with an explicit snapshot/rollback wrapper.
- Added `RollbackActionParams` and `RollbackAfterFailureParams` types to the public API.

### Changed
- Action names starting with `_` or `$` are rejected by the rollback wrapper to protect internal store methods.
- Rollback tracking data (`rollbackAfterFailure` params and pending snapshots) is now cleaned up when a store is disposed, preventing memory leaks with dynamically created stores.

## [0.1.8]

### Added 
- Added `onError` parameter to `storeOnActionSubscription` method
- Added `onError` property to `StoreOnActionCallbackParameters` interface

### Changed
- Changing the directory structure

## [0.1.7]

### Changed
- Hardened SSR hydration sequencing so `hydrate()` always runs before `afterHydration()` and lifecycle errors are caught without breaking store registration.
- Improved reset-state cloning to avoid JSON-only pitfalls during `$reset`, including structured values such as `Map` and `Set`.
- Ensured tracking metadata is cleared when a store is disposed to prevent stale subscriber state.
- Tightened internal store checks to avoid `hasOwnProperty` collisions.
- Reduced library bundle overhead by stripping the Vue plugin from the library build and treeshaking the published bundle more aggressively.
- Added additive sub-exports for helper-only imports and a strict type-only public surface to keep the core API stable while improving bundle clarity.
- Added a real bundle-size check command to measure the emitted output before deciding whether a heavier split is justified : `npm run bundle:check`.
- Documented Nuxt / SSR best practices for `hydration: 'defer'`, `runtimeEnvironment`, and browser-only access in hydrated stores.

## [0.1.6]

### Added
- Added `execution` and `hydrationScheduler` support on `PluginSubscriber` / `PluginSubscriberInterface`.
- Added `createHydrationPlugin()` as the dedicated Nuxt / SSR hydration helper.
- Added `PluginSubscriptionOptions` for hydration-specific runtime overrides without changing the default `createPlugin()` API.
- Added optional `hydrate()` and `afterHydration()` lifecycle hooks to the subscriber and base `Store` contract for SSR-safe initialization logic.

### Changed
- The execution policy now defaults to the subscriber itself, with framework-specific overrides available only through the hydration helper.
- `PluginSubscription` resolves hydration timing from the subscriber before falling back to the global runtime scheduler.
- The base `Store` class now exposes lifecycle stubs so browser-only bootstrap code can be triggered after the plugin is accepted for execution instead of during construction.

### Fixed
- Avoided SSR hydration crashes by allowing client-only Pinia plugins to be skipped on the server or deferred on the client.
- Prevented browser-only initialization from running during server-side store creation by moving hydration bootstrap behind the subscriber lifecycle hooks.

## [0.1.5]

Minor change


## [0.1.4]

### Added
- Added `defineAStoreCtx()` with mandatory setup context argument for improved developer experience.
- Added `DefineAStoreSetupExtensions` with `enhancedStore` and `extending` extension keys.
- Added `getEnhancedStore()` and `setEnhancedStore()` helpers for context-based store enhancements.

### Changed
- `getDefineAStoreSetupContext()` now falls back to store ID lookup during plugin execution timing.
- `defineAStoreSetup()` now stores setup contexts only for stores with `storeOptions.enhancedStore = true`.
- `defineAStoreSetup()` now removes ID-indexed setup contexts after weak-map registration and on store disposal.
- Public exports now include `defineAStoreCtx`, `getEnhancedStore`, and `setEnhancedStore`.
- GitHub Actions now publishes GitHub pre-releases to npm with the `beta` dist-tag.

### Added
- Added a Vitest performance-oriented test for setup-context tracking behavior with and without `enhancedStore`.

### Deprecated
- `ctx.extensions.extending` is deprecated. Use `ctx.extensions.enhancedStore`.
- `getExtendingStore()` is deprecated. Use `getEnhancedStore()`.

## [0.1.3] - 2026-08-15

### Added
- Added setup context lookup by store ID before the store is registered in the `WeakMap`.
- Added the `DefineAStoreSetupContext` type with store ID and extension metadata.
- Added the `getExtendingStore()` helper to retrieve the extending store from a setup context.
- Exported `getExtendingStore()` from the public library entry point.
- Added test coverage for retrieving setup context by ID before store registration.

### Changed
- Stored setup contexts in an ID-indexed `Map` in addition to the store-indexed `WeakMap`.
- Added the protected static `Store.hasRequiredKeys()` helper.
- Promoted `DefineAStoreSetupContext` to the shared store types.

## [0.1.2] - 2026-08-09

### Fix
- Added export helper class and functions


## [0.1.1] - 2026-08-08

### Added
- Added a GitHub Actions workflow to run the test suite on every push and pull request.
- Added npm provenance-based publishing for improved supply-chain security.
- Added a CODEOWNERS file to require maintainer review for repository changes.
- Included documentation files in the published npm tarball to improve package quality signals.

### Changed
- Improved package metadata for npm publishing and discoverability.
- Documented the release and publishing process in the README.
- Added explicit package publishing configuration for public access and provenance.

### Security
- Improved release transparency by publishing with npm provenance.
- Added security and contribution documentation to the package contents.

## [0.1.0] - 2026-08-07

### Added
- **Core Plugin System:** `createPlugin()` function to create Pinia plugins from subscribers.
- **PluginSubscriber Class:** Abstract base class for creating reusable plugin subscribers.
- **Store Helper Class:** Wrapper around PiniaStore with utilities for state and subscription management.
- **PluginSubscriberInterface:** Interface for implementing custom subscribers.
- **Debug Mode:** Detailed logging support for plugin development and troubleshooting.
- **Reset Callbacks:** Custom store reset logic via `resetStoreCallback`.
- **Type Definitions:** Full TypeScript support with comprehensive type exports.
- **Test Suite:** Comprehensive Vitest coverage for all core functionality.
- **Documentation:** Complete README with API reference and examples.
- **MIT License:** Open source license for community use.

### Features
- Centralized subscriber registration for Pinia stores.
- `$reset` method added to all stores modified by the plugin.
- Support for store mutations and action subscriptions.
- Plugin-specific subscription management.
- State helper methods: `addToState()`, `stateHas()`, `getValue()`.
- Store helper methods: `storeHas()`.
- Performance monitoring utilities.
- Validation utilities for common object operations.

### Documentation
- Installation and usage examples.
- API reference for all public classes and functions.
- Contributing guidelines.
- Security policy.

[0.1.1]: https://github.com/AlxBDo/pinia-plugin-subscription/releases/tag/v0.1.1
[0.1.0]: https://github.com/AlxBDo/pinia-plugin-subscription/releases/tag/v0.1.0
