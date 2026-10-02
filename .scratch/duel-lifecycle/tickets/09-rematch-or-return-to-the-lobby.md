# Rematch or Return to the Lobby

Status: completed
Completed: 2026-10-01 10:30 PM
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Complete the repeat-play loop after normal Post-Duel. Record each player's Rematch intent, automatically create one fresh Duel only after both request it, reset both players to 100 HP, retain Lobby Prompt history, and reuse the established first-Round preparation path. If either player selects Back to Lobby, return both players together, clear all post-Duel intent, and restore readiness and Host-controlled start.

## Acceptance criteria

- [x] One Rematch request records visible intent but cannot create a new Duel alone.
- [x] Two accepted Rematch requests create exactly one new Duel with both players at 100 HP and Round number reset.
- [x] The Rematch uses the established Prompt Catalog and reusable Round preparation path rather than a separate start implementation.
- [x] Lobby used-Prompt history persists across the completed Duel and Rematch, exhausting enabled Prompts before reuse.
- [x] Either player's accepted Back to Lobby command returns both players, clears Rematch intent, clears completed Duel state, and resets both Lobby readiness values.
- [x] Only the ready Host can start a later Duel from the restored Lobby.
- [x] Serialized simultaneous Rematch/Back commands produce one deterministic valid transition and cannot strand the clients in different lifecycle states.
- [x] A deterministic two-socket regression completes multiple Rounds through zero HP, displays Post-Duel, starts a Rematch, and observes reset HP with retained Prompt history.

## Blocked by

- [`duel-lifecycle/08`](./08-complete-the-duel-and-show-post-duel.md)

## Out of scope

- Replacement players or new Lobby membership
- Persistent match history or Rematch analytics
- Custom Duel settings

## Comments

- 2026-07-12: This ticket closes the core product hypothesis loop: face the same opponent, finish, and voluntarily start another Duel.
- 2026-10-01: Added scoped Rematch and Back to Lobby commands, visible intent, synchronized client routing, and deterministic core, socket, contract, and client regressions. Validation passed with 268 tests passing and 5 skipped, plus typecheck, build, and lint. Standards and spec reviews found no actionable issues.
