# Complete the Duel and Show Post-Duel

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Complete a Duel normally when a final Round Outcome reduces a player to zero HP. Preserve the decisive Post-Round comparison, then allow each player to continue independently to a concise Post-Duel summary showing the winner, normal outcome reason, final HP, and damage by Round.

## Acceptance criteria

- [ ] A Round Outcome that reduces a player to zero HP marks the Duel normally completed immediately and cannot be followed by another Round.
- [ ] The final Round's complete Post-Round comparison remains visible before Post-Duel.
- [ ] Each player can continue from final Post-Round to Post-Duel independently without moving the other player's view.
- [ ] Post-Duel shows the HP winner, normal completion reason, both final HP values, and ordered damage by Round from authoritative stored outcomes.
- [ ] No client calculates final HP, reconstructs Round damage, or changes completed Duel state.
- [ ] Late Navigation, readiness, and duplicate continue commands cannot reopen or mutate the completed Duel.
- [ ] Forfeit and Interruption do not enter this normal Post-Duel flow.
- [ ] Tests cover exact-zero and overkill-clamped completion, asymmetric continuation, summary projection, and rejected late commands.

## Blocked by

- [`duel-lifecycle/07`](./07-reveal-post-round-and-continue.md)

## Out of scope

- Rematch and Back to Lobby transitions
- Best paths, fastest arrival, rounds-won highlights, or feedback
- Persistent results, analytics, history, sharing, or replay

## Comments

- 2026-07-12: The final Post-Round route comparison remains mandatory even though the Duel is already authoritatively complete.
