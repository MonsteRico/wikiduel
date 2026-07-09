# Enrich the Post-Duel Summary

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Add rounds-won totals, each player's best completed path, and fastest Target Arrival to the essential post-Duel result without delaying Rematch.

## Acceptance criteria

- [ ] Best path uses fewest Navigations with active elapsed time as tie-breaker.
- [ ] Fastest Target Arrival excludes Rounds where the player never arrived.
- [ ] Missing highlights are omitted rather than shown as misleading zero values.
- [ ] Rematch remains the primary action.

## Blocked by

- [`duel-rematch/01`](../../duel-rematch/tickets/01-complete-and-rematch-a-duel.md)

## Out of scope

- Feedback collection
- Match history, replay, or sharing

## Comments

- 2026-07-03: Classified as MVP optional summary polish for a larger-group test.
