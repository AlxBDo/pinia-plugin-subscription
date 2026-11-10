# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add `$onResetStore(callback)` to register per-store callbacks that run after the state snapshot reset wrapper restores the initial state.

### Changed (breaking)
- Reset callbacks are no longer configured through the `onResetStore` store option and no longer enable reset wrapping; set `overrideReset` to enable the wrapper.
