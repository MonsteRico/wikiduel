# Apply HP and Damage

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Give both players 100 HP at Duel start and apply the locked MVP Damage Rule after each won Round:

```text
damage = clamp(25 + 3 * (loser_clicks - winner_clicks), 15, 60)
```

The server alone calculates damage, updates HP, and supplies an explainable breakdown for both clients.

## Acceptance criteria

- [ ] Both players start every new Duel and Rematch at 100 HP.
- [ ] Click counts at frozen Round end produce the specified damage.
- [ ] Damage never falls below 15 or exceeds 60.
- [ ] Timeout draws deal zero damage.
- [ ] HP persists between Rounds, never falls below zero, and ends the Duel at zero.
- [ ] Both clients display the same server-provided inputs, calculation, damage, and resulting HP.

## Blocked by

- [`round-start/01`](../../round-start/issues/01-enter-the-first-round.md)
- [`navigation/01`](../../navigation/issues/01-navigate-and-track-the-player-path.md)

## Out of scope

- Distance, time, category, difficulty, or shortest-path inputs
- Selectable or per-Lobby Damage Rules
- Balance tuning beyond the locked formula

## Comments

- 2026-07-03: Formula locked for MVP testing.
