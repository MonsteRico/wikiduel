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
- [ ] Completed routes from lost Rounds remain eligible for that player's best-path and fastest-arrival highlights. Use individual arrival elapsed times, not whole-Round duration; exclude unfinished routes and do not count draws as wins.
- [ ] Rematch remains the primary action and does not wait for optional summary work.

## Blocked by

- [`duel-lifecycle/09`](./09-rematch-or-return-to-the-lobby.md)
- [`duel-lifecycle/18`](./18-implement-click-scored-rounds.md)

## Out of scope

- Feedback collection
- Match history, route replay, sharing, or profiles

## Comments

- 2026-07-12: Deferred summary polish for a larger-group test.
- 2026-10-02: Remains optional and excluded from ticket 18. The required existing summary will support draws and new win reasons without these highlights.
