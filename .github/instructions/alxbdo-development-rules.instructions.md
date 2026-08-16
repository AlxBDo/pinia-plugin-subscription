---
description: "Global development rules for AlxBDo projects"
applyTo: "**/*"
---

- Do not compromise security (vulnerabilities, data/session protection, secrets handling).
- Respect SOLID principles and favor DRY implementations.
- Prefer performance over UX unless UX impact is clearly low.
- Every new feature must be documented in `README.md` and `CHANGELOG.md`, and tested with Vitest.
- Define reusable types in `src/types/`; only keep one-off disposable types inline.
- Prefer interfaces for object/class typing when reuse with `Pick`, `Omit`, etc. is expected.
- Follow language best practices and conventions.
- Follow framework/library best practices and conventions.
- If code being explored violates these rules, call it out explicitly with concrete remediation suggestions.
