# Add Configurable Time Limits

Status: needs-info
Scope: Future
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

If evidence shows the five-minute toggle delivered by [duel-lifecycle/18](./18-implement-click-scored-rounds.md) is insufficient, allow supported duration choices in the Lobby. Retain one authoritative value for both players and the approved expiry rules: a sole arrival wins for 60 damage, and neither arrival means a zero-damage draw.

## Acceptance criteria

- [ ] Both players see the selected Time Limit before readying.
- [ ] A setting change clears readiness and cannot affect an active or completed Duel.
- [ ] The server remains authoritative for deadline timing and Round Outcome creation.
- [ ] The ticket is refined against observed Time Limit usage before implementation.

## Blocked by

- [`duel-lifecycle/18`](./18-implement-click-scored-rounds.md)
- Evidence that the fixed five-minute Time Limit is insufficient.

## Out of scope

- Per-player limits
- Changing the limit during a Duel
- Selecting a timeout winner from partial progress

## Comments

- 2026-07-12: Future work only; required Duels have no Time Limit and optional fixed timing must exist first.
- 2026-10-02: The earlier scope is historical. The fixed five-minute toggle is required under ticket 18; duration choices remain Future work based on usage evidence.
