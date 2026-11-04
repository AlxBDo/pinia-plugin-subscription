# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.2]

### Fixed
- Devtools: collapsed payloads show their keys (`{ store, subscribers }`) instead of their count (`{3}`); `PluginSubscriber` instances keep their name in the context (the plugin traces plain `{ name, execution, pluginOptions }` objects); `toSerializable` includes accessors and methods inherited from class prototypes (e.g. extended stores); the Context tab re-reads the live store on each render instead of freezing its first snapshot. `PluginSubscription` now traces the store context after its subscribers ran (so state/actions/computeds added by `pinia-plugin-extending-store` `parentsStores` are included, including with `redact: true`, which copies the payload), and the redactor keeps accessors inherited from class prototypes. A getter that throws during redaction (e.g. the `contact` computed of a store being set up) is now shown as `[Unreadable]` instead of failing the whole payload, which used to leave the Context tab empty (the `__traceRedactionError` key was also hidden by `toSerializable`, and is now displayed).

## [1.0.0-beta.1]

### Fixed
- `pinia-plugin-subscription-devtools` 1.0.0-beta.1: the panel now refreshes live. The beta.0 bundle was built with Rollup `treeshake.propertyReadSideEffects: false`, which stripped the `version.value` reads from the `computed`s, so the store list and events were computed once at mount (empty journal) and showed "No store traced yet." until remounted. The option is removed from the devtools build; regression tests cover live updates and the error badge