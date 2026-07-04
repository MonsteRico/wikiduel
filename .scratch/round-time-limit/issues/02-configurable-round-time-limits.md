# Add Configurable Round Time Limits

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Allow supported Time Limit choices to be configured before a Duel while preserving one authoritative value for both players and an unambiguous timeout outcome.

## Acceptance criteria

- [ ] Both players see the selected Time Limit before readying.
- [ ] A setting change clears readiness and cannot affect an active Duel.
- [ ] The server remains authoritative for timeout timing and outcome.

## Blocked by

- Evidence from MVP testing that the fixed five-minute Time Limit is insufficient.

## Out of scope

- Per-player limits
- Changing the limit during a Duel
- Picking a timeout winner from partial progress

## Comments

- 2026-07-03: Deferred until after MVP testing. Required MVP Rounds always use a fixed five-minute limit.
