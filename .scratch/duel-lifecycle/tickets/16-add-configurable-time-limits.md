# Add Configurable Time Limits

Status: needs-info
Scope: Future
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

If evidence shows one fixed Time Limit is insufficient, allow supported duration choices before a Duel while retaining one authoritative value for both players and the existing no-damage timeout outcome.

## Acceptance criteria

- [ ] Both players see the selected Time Limit before readying.
- [ ] A setting change clears readiness and cannot affect an active or completed Duel.
- [ ] The server remains authoritative for deadline timing and Round Outcome creation.
- [ ] The ticket is refined against observed Time Limit usage before implementation.

## Blocked by

- [`duel-lifecycle/11`](./11-add-the-fixed-time-limit.md)
- Evidence that the fixed five-minute Time Limit is insufficient.

## Out of scope

- Per-player limits
- Changing the limit during a Duel
- Selecting a timeout winner from partial progress

## Comments

- 2026-07-12: Future work only; required Duels have no Time Limit and optional fixed timing must exist first.
