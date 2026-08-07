# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-07

### Added
- **Core Plugin System:** `createPlugin()` function to create Pinia plugins from subscribers
- **PluginSubscriber Class:** Abstract base class for creating reusable plugin subscribers
- **Store Helper Class:** Wrapper around PiniaStore with utilities for state and subscription management
- **PluginSubscriberInterface:** Interface for implementing custom subscribers
- **Debug Mode:** Detailed logging support for plugin development and troubleshooting
- **Reset Callbacks:** Custom store reset logic via `resetStoreCallback`
- **Type Definitions:** Full TypeScript support with comprehensive type exports
- **Test Suite:** Comprehensive Vitest coverage for all core functionality
- **Documentation:** Complete README with API reference and examples
- **MIT License:** Open source license for community use

### Features
- Centralized subscriber registration for Pinia stores
- `$reset` method added to all stores modified by the plugin
- Support for store mutations and action subscriptions
- Plugin-specific subscription management
- State helper methods: `addToState()`, `stateHas()`, `getValue()`
- Store helper methods: `storeHas()`
- Performance monitoring utilities
- Validation utilities for common object operations

### Documentation
- Installation and usage examples
- API reference for all public classes and functions
- Contributing guidelines
- Security policy

[0.1.0]: https://github.com/AlxBDo/pinia-plugin-subscription/releases/tag/v0.1.0
