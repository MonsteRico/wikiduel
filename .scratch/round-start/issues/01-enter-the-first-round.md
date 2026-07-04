# Enter the First Round

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Extend the implemented `game-started` boundary into the first authoritative Duel and Round. When the ready Host starts, create 100-HP player state, choose one unused curated prompt, enter Round preparation, and project the correct initial Duel screen to both players.

## Acceptance criteria

- [ ] Only the ready Host in a full Lobby can create a Duel.
- [ ] Both players begin at 100 HP in Round one.
- [ ] The server selects one unused enabled prompt and gives both players the same start and target.
- [ ] Each player's authoritative current article and displayed path begin at the canonical start with zero clicks.
- [ ] Both clients leave the Lobby UI and show the preparing Duel state.
- [ ] Commands invalid for the current Lobby/Duel/Round state are rejected without mutation.
- [ ] Starting twice cannot create competing Duels or Rounds.

## Blocked by

- The already implemented private Lobby baseline.
- [`playable-articles/01`](../../playable-articles/issues/01-fetch-and-sanitize-playable-articles.md)
- [`prompt-pool/01`](../../prompt-pool/issues/01-curate-first-ten-prompts.md)

## Out of scope

- Starting Navigation before synchronized preparation completes
- Damage, timeout, post-Round comparison, or Rematch

## Comments

- 2026-07-03: This is the first tracer bullet beyond the implemented Lobby boundary.
