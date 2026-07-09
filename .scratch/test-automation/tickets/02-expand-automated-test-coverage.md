# Expand Automated Test Coverage

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Broaden automated confidence before a larger-group test with two-browser critical-flow coverage, accessibility checks, and regressions for failures found during the first small-group test.

## Acceptance criteria

- [ ] Two isolated browser contexts complete create/join, one Round, path comparison, Duel completion, and Rematch.
- [ ] Automated accessibility checks cover stable primary screens.
- [ ] Failures discovered in the first test receive focused regression tests where deterministic automation is practical.

## Blocked by

- Stable required-MVP flow.
- Findings from the first small-group test.

## Out of scope

- Live Wikipedia calls in deterministic CI
- Exhaustive browser/device matrices

## Comments

- 2026-07-03: Classified as MVP optional; narrow tests for risky authoritative rules may still accompany their required slices.
