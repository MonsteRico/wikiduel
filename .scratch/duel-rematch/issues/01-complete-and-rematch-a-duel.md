# Complete and Rematch a Duel

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Carry HP across Rounds until one player reaches zero, show the winner/outcome, final HP, and damage by Round, then let both players start a fresh Duel in the same Lobby or return together to its ready state.

## Acceptance criteria

- [ ] HP starts at 100, persists between Rounds, and clamps at zero.
- [ ] The Duel ends immediately after a Round reduces a player to zero HP.
- [ ] The essential normal-completion summary shows the HP winner, final HP, and damage by Round.
- [ ] A Rematch starts only after both players request it and resets both players to 100 HP.
- [ ] `Back to Lobby` clears rematch intent and restores the ready/Host-start flow.
- [ ] Used prompts do not repeat in the Lobby until its enabled pool is exhausted.

## Blocked by

- [`round-results/01`](../../round-results/issues/01-compare-paths-after-each-round.md)
- The required Lobby and Damage Rule slices.

## Out of scope

- Best-path and fastest-arrival awards
- Match history, profiles, sharing, or replay
- Persistent results

## Comments

- 2026-07-03: The multi-round HP loop and low-friction Rematch are non-negotiable MVP boundaries.
