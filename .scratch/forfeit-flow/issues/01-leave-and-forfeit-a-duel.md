# Leave and Forfeit a Duel

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Require confirmation before a player deliberately leaves an active Duel. Confirmation immediately causes a Forfeit, disbands the Lobby, returns the departing player home, and tells the remaining player that their opponent left.

An unexpected required-MVP disconnect uses the same terminal Forfeit and disband behavior without a confirmation step.

## Acceptance criteria

- [ ] Cancelling the confirmation leaves the active Duel unchanged.
- [ ] Browser Back or an in-app route change during an active Duel is treated as a leave attempt and asks for confirmation where the browser permits interception.
- [ ] Confirming departure prevents further Duel commands and disbands the Lobby exactly once.
- [ ] The departing player returns home.
- [ ] The remaining player sees a clear `Opponent left` notice and can return home.
- [ ] No normal post-Duel result or winner summary is shown.
- [ ] Connection loss produces the same disband outcome without hanging the remaining client.
- [ ] Closing or reloading the page cannot leave a ghost active Duel; loss of connection triggers Forfeit/disband even when a custom confirmation cannot be guaranteed.

## Blocked by

- The required authoritative Lobby and Duel lifecycle.

## Out of scope

- A Forfeit result screen
- Reconnection or interruption budgets
- Persistent Forfeit analytics

## Comments

- 2026-07-03: A clear terminal notice is required; treating Forfeit like a scored result is optional.
