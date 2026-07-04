# Show Required Live Opponent Status

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

During an active Round, show the opponent's authoritative HP, click count, and connection state while ensuring their current article, live path, and any estimated distance remain hidden.

## Acceptance criteria

- [ ] HP and click count update from authoritative server projections.
- [ ] Connection loss is communicated clearly before the required Forfeit outcome replaces the active Round.
- [ ] No active-Round message sent to the opponent contains the player's current article, route, or estimated distance.
- [ ] The HUD remains understandable without relying on color alone.

## Blocked by

- [`round-start/01`](../../round-start/issues/01-enter-the-first-round.md)
- [`navigation/01`](../../navigation/issues/01-navigate-and-track-the-player-path.md)

## Out of scope

- Activity animation
- Opponent article, route, or distance disclosure
- Spectator projections

## Comments

- 2026-07-03: Opponent article, path, and estimated distance are deliberately hidden, not planned Future features.
