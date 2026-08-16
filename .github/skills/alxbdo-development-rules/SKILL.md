---
name: alxbdo-development-rules
description: Apply AlxBDo engineering rules (security, SOLID/DRY, performance-first, docs/tests/types conventions) before implementing changes.
---

# AlxBDo Development Rules

Use this skill before implementing features or fixes.

## Mandatory checks

1. Security must not be degraded (vuln surface, data/session protection, secrets handling).
2. Respect SOLID and strongly favor DRY.
3. Prioritize performance over UX, unless UX impact is low.
4. For every feature:
   - update `README.md`,
   - update `CHANGELOG.md`,
   - add or update Vitest tests.
5. Put reusable types in `src/types/`; keep only one-off disposable types inline.
6. Prefer interfaces for reusable object/class typing (`Pick`, `Omit`, etc.).
7. Follow language conventions and framework/library best practices.
8. Explicitly report rule violations discovered in explored code, with remediation.

## Portable usage in other projects

Copy these files into the target repository:
- `.github/instructions/alxbdo-development-rules.instructions.md`
- `.github/skills/alxbdo-development-rules/SKILL.md`

Then invoke the skill `alxbdo-development-rules` at the beginning of implementation sessions.
