# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add `$onResetStore(callback)` to register per-store callbacks that run after the state snapshot reset wrapper restores the initial state.
- `rollbackAfterFailure: true` enables manual rollback without automatic snapshots; the subscriber's `rollbackAfterFailure` flag enables it for all stores.

### Changed (breaking)
- The subscriber creates a per-store `StateSnapshots` wrapper only when `overrideReset` or `rollbackAfterFailure` is enabled. Manual rollback is no longer installed for stores without either option; reset callbacks are installed only with reset wrapping.
- Requires the new `PluginSubscriber` and shared store-event handler contract from `pinia-plugin-subscription`; update the peer dependency minimum when the compatible release is published.
- Automatic rollback now logs restoration failures and preserves the original action error; manual rollback still propagates both errors in an `AggregateError`.
- The former `onResetStore` store option is replaced by `onReset` and `$onResetStore(callback)`. The subscriber requires `overrideReset` or `rollbackAfterFailure`; when enabled, `onReset` also installs the reset wrapper.
