# Show a Forfeit Summary

Status: ready-for-agent
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Replace the required plain terminal departure notice with a clear summary of the forfeited Duel while keeping Forfeit distinct from normal HP victory and from Interruption.

## Acceptance criteria

- [ ] The summary identifies that the Duel ended by Forfeit and gives the available reason.
- [ ] It does not fabricate a Round Outcome, damage, winner, or normal final Round.
- [ ] It remains distinct from an Interruption caused by system failure.
- [ ] Both players can leave the disbanded Lobby cleanly.

## Blocked by

- [`duel-lifecycle/10`](./10-confirm-leave-duel-and-forfeit.md)

## Out of scope

- Scoring Forfeit as normal victory
- Persistent Forfeit analytics

## Comments

- 2026-07-12: `Opponent left` remains sufficient for the first small-group test.
