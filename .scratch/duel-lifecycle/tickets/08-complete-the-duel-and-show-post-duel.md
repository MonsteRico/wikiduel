# Complete the Duel and Show Post-Duel

Status: completed
Completed: 2026-10-01 08:25 PM via [PR #23](https://github.com/MonsteRico/wikiduel/pull/23)
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Complete a Duel normally when a final Round Outcome reduces a player to zero HP. Preserve the decisive Post-Round comparison, then allow each player to continue independently to a concise Post-Duel summary showing the winner, normal outcome reason, final HP, and damage by Round.

## Acceptance criteria

- [x] A Round Outcome that reduces a player to zero HP marks the Duel normally completed immediately and cannot be followed by another Round.
- [x] The final Round's complete Post-Round comparison remains visible before Post-Duel.
- [x] Each player can continue from final Post-Round to Post-Duel independently without moving the other player's view.
- [x] Post-Duel shows the HP winner, normal completion reason, both final HP values, and ordered damage by Round from authoritative stored outcomes.
- [x] No client calculates final HP, reconstructs Round damage, or changes completed Duel state.
- [x] Late Navigation, readiness, and duplicate continue commands cannot reopen or mutate the completed Duel.
- [x] Forfeit and Interruption do not enter this normal Post-Duel flow.
- [x] Tests cover exact-zero and overkill-clamped completion, asymmetric continuation, summary projection, and rejected late commands.

## Blocked by

- [`duel-lifecycle/07`](./07-reveal-post-round-and-continue.md)

## Out of scope

- Rematch and Back to Lobby transitions
- Best paths, fastest arrival, rounds-won highlights, or feedback
- Persistent results, analytics, history, sharing, or replay

## Comments

- 2026-07-12: The final Post-Round route comparison remains mandatory even though the Duel is already authoritatively complete.

- 2026-10-01: Added server-owned outcome history and independent Post-Duel continuation, strict contracts, and the summary screen. Core, decoder, WebSocket, and client tests cover completion and late-command rejection. Standards and spec reviews found no issues.
