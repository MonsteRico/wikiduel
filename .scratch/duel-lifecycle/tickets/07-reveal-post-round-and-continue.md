# Reveal Post-Round and Continue the Duel

Status: completed
Completed: 2026-10-01 07:22 PM via [PR #22](https://github.com/MonsteRico/wikiduel/pull/22)
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Turn an authoritative Round Outcome into the core route-discussion moment. Both players see the same winner, Prompt, frozen paths, clicks, active times, Damage Rule breakdown, and resulting HP. After a non-final Round, collect one-way readiness from both players, select the next unused Prompt, and return through the reusable Round preparation path.

## Acceptance criteria

- [x] Both clients enter Post-Round from the same immutable Round Outcome.
- [x] Winner, Prompt, both frozen paths through each final article, clicks, active elapsed times, damage breakdown, and resulting HP are readable side by side.
- [x] Post-Round never recomputes damage or derives authoritative outcome data on the client.
- [x] A player may indicate `Ready for Next Round` once; stale, duplicate, or wrong-Duel readiness cannot advance state.
- [x] The next Round cannot enter preparation until both players are ready.
- [x] Both-ready selects one unused enabled Prompt and enters the same preparation interface used by Round one.
- [x] HP persists unchanged from the prior Round Outcome into the next Round.
- [x] A final Round still presents the full comparison but does not offer next-Round readiness.
- [x] The only required exit from a non-final Post-Round is the confirmed Leave Duel flow.
- [x] Client and two-socket integration tests cover asymmetric readiness, duplicate readiness, later-Round preparation, and frozen-route presentation.

## Blocked by

- [`duel-lifecycle/06`](./06-navigate-and-show-the-active-round.md)

## Out of scope

- Animated route replay or automated route-quality judgments
- Sharing results outside the Lobby
- Normal Post-Duel summary, Rematch, or Back to Lobby
- Time Limit draws until the optional ticket is implemented

## Comments

- 2026-07-12: Post-Round is the synchronized presentation/readiness phase; Round Outcome is the server record it consumes.
- 2026-10-01: Added the authoritative comparison, scoped one-way readiness, and confirmed departure. Later Rounds retain HP and reuse covered preparation. Departure after completion closes the Lobby without changing the final winner. Validation passed with 254 tests, typecheck, build, and lint. Five live tests remain opt-in; lint retains the existing HomePage effect warning.
