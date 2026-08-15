# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
