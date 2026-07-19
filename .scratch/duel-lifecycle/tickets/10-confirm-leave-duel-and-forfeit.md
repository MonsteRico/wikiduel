# Confirm Leave Duel and Forfeit

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Complete the player-facing departure path around the core's existing disconnect safety. During any active Duel phase, explicit Leave Duel, in-app route changes, and interceptable browser Back attempts require confirmation. Confirmation terminates by Forfeit, disbands the Lobby exactly once, returns the departing player home, and gives the remaining player a clear opponent-left notice. Unavoidable close, reload, or connection loss uses the same core terminal invariant without promising a custom confirmation.

## Acceptance criteria

- [ ] Cancelling an explicit departure confirmation leaves the current Duel phase and state unchanged.
- [ ] Confirming Leave Duel prevents further commands, produces one Forfeit, and disbands the Lobby exactly once.
- [ ] In-app route changes and browser Back are treated as leave attempts and request confirmation where interception is supported.
- [ ] Confirmed departure returns the departing player home and lets the remaining player leave a clear `Opponent left` notice for home.
- [ ] Close, reload, or connection loss cannot leave a ghost Duel; the existing disconnect invariant terminates without requiring an impossible custom confirmation.
- [ ] Forfeit enters no normal Round Outcome, Post-Round, winner, damage, or Post-Duel summary flow.
- [ ] Stale confirmation, repeated departure, disconnect-after-confirmation, and duplicate close events cannot disband twice or emit conflicting terminal projections.
- [ ] Client and two-socket tests cover cancellation, confirmation from each lifecycle phase, browser navigation where testable, unexpected disconnect, and terminal notices.

## Blocked by

- [`duel-lifecycle/02`](./02-enter-the-first-duel.md)

## Out of scope

- A rich Forfeit summary
- Reconnection windows or interruption budgets
- Persistent Forfeit analytics

## Comments

- 2026-07-12: The core disconnect invariant lands earlier; this ticket owns explicit confirmation and complete departure UX.
