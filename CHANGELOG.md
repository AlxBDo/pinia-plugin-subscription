# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7]

### Changed
- Hardened SSR hydration sequencing so `hydrate()` always runs before `afterHydration()` and lifecycle errors are caught without breaking store registration.
- Improved reset-state cloning to avoid JSON-only pitfalls during `$reset`, including structured values such as `Map` and `Set`.
- Ensured tracking metadata is cleared when a store is disposed to prevent stale subscriber state.
- Tightened internal store checks to avoid `hasOwnProperty` collisions.
- Reduced library bundle overhead by stripping the Vue plugin from the library build and treeshaking the published bundle more aggressively.
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
- `defineAStoreSetup()` now logs setup-context map size transitions when `storeOptions.debug = true`.
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
