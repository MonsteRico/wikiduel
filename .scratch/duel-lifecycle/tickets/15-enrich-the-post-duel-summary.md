# Enrich the Post-Duel Summary

Status: ready-for-agent
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Add rounds-won totals, each player's best completed path, and fastest Target Arrival to the essential Post-Duel summary without delaying or visually displacing Rematch.

## Acceptance criteria

- [ ] Best path uses fewest Navigations among that player's completed targets, with active elapsed time as tie-breaker.
- [ ] Fastest Target Arrival excludes Rounds where the player never arrived.
- [ ] Missing highlights are omitted rather than displayed as misleading zero values.
- [ ] All highlights derive from authoritative stored Round Outcomes.
- [ ] Rematch remains the primary action and does not wait for optional summary work.

## Blocked by

- [`duel-lifecycle/09`](./09-rematch-or-return-to-the-lobby.md)

## Out of scope

- Feedback collection
- Match history, route replay, sharing, or profiles

## Comments

- 2026-07-12: Deferred summary polish for a larger-group test.
