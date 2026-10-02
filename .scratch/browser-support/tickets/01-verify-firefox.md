# Verify Firefox

Status: completed
Completed: 2026-10-02 12:49 PM
Scope: MVP required
Category: enhancement

## What to build

Verify and correct the complete first-test desktop Duel flow in current Firefox, the primary browser used during development and playtesting.

## Acceptance criteria

- [x] Lobby creation, joining, readiness, and Host start work in current Firefox.
- [x] Playable Article content, images, and Navigation render and behave correctly.
- [x] Round preparation, countdown, elapsed stopwatch, live status, path comparison, Duel completion, and Rematch work in Firefox.
- [x] Departure confirmation and disconnect warning behavior are verified in Firefox.
- [x] Firefox-specific failures receive focused regression coverage where practical; no unresolved Firefox-specific failure was reported in this verification.

## Blocked by

- Stable required-MVP flow.

## Comments

- 2026-07-03: Firefox is MVP required because it is the primary development and playtest browser.
- 2026-10-02: The maintainer confirmed a completed two-browser manual Firefox playthrough, followed by verification of disconnect warning behavior after the departure work. Completion records that manual verification; it does not claim an agent-run browser test. Replaced the obsolete Time Limit criterion with the required elapsed stopwatch; the optional Time Limit remains tracked in duel-lifecycle/11.
