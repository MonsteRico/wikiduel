# Preserve a Duel Through a Short Reconnect Window

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Allow a Player Session that briefly loses its socket connection to reclaim its seat from the same browser within one short, fixed window. Pause the active Duel while reconnection is possible, then resume both players from authoritative server state or award a Forfeit when the window expires.

This is a self-contained resilience improvement for playtests. The required MVP may instead end the Duel immediately when a player disconnects.

## Acceptance criteria

- [ ] A brief same-browser disconnect does not immediately destroy the active Duel.
- [ ] Both players see clear paused, reconnected, and expired states.
- [ ] A successful reconnect restores authoritative state before Navigation resumes.
- [ ] Expiry produces a deterministic Forfeit rather than an abandoned Duel.
- [ ] The reconnect duration is one fixed product value, not a Lobby setting.

## Blocked by

- The required MVP Player Session and authoritative Duel-state slices.

## Out of scope

- Cross-device recovery
- Long-lived Lobby recovery
- Recovery after a backend restart
- Configurable or cumulative interruption budgets

## Comments

- 2026-07-03: Classified as MVP optional. It is useful for cleaner playtests but does not block the first working multi-round Duel.
