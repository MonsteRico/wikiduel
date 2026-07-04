# Persist Completed Duels

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Persist completed Round and Duel summaries, player paths, outcome reasons, and versioned Damage Rule inputs so results survive backend restarts and can support a larger playtest.

Active Lobby and Duel state remains authoritative in memory. Persistence must not delay Navigation or become required to finish a Duel.

## Acceptance criteria

- [ ] Completed Round and Duel summaries survive backend restarts.
- [ ] Stored paths and damage inputs reproduce the displayed outcome.
- [ ] A persistence failure does not corrupt or stall the active Duel.
- [ ] No recoverable Player Session credentials or raw article HTML are stored.

## Blocked by

- The required full HP Duel and path-tracking slices.

## Out of scope

- Recovering active Duels after restart
- Analytics dashboards
- Automated retention cleanup

## Comments

- 2026-07-03: Classified as MVP optional for a larger-group playtest. The first small-group test uses in-memory state and structured logs.
