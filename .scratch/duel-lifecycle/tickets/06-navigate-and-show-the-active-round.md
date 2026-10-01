# Navigate and Show the Active Round

Status: completed
Completed: 2026-10-01 06:53 PM
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Deliver the complete active-Round racing interaction. A player selects a Navigation Node from the authoritative current Playable Article, the server retrieves and validates the canonical destination before committing exactly one Navigation, and Target Arrival invokes the authoritative Round Outcome transition. Show the player's route and the permitted live opponent status while proving that opponent-private article and path information never crosses the realtime seam.

## Acceptance criteria

- [x] The server accepts a destination only when it is a Navigation Node on the player's authoritative current Playable Article for the active Round.
- [x] A destination Playable Article is retrieved successfully before the authoritative path or click count changes.
- [x] Each accepted Navigation appends exactly one canonical destination and increments clicks exactly once, including redirects resolved within that Navigation.
- [x] Invalid, failed, stale, duplicate, wrong-source, wrong-Round, and pre-start requests do not change path or clicks.
- [x] Only one Navigation may resolve for a player at a time; the client disables Navigation Nodes while it is in flight and the server rejects conflicting requests.
- [x] Reaching the canonical target immediately invokes the Round Outcome transition and rejects later Navigation.
- [x] The player sees the target, current Round number, both HP values, their display-only path and clicks, the opponent's click count and connection state, and elapsed stopwatch time.
- [x] Old path entries and browser history cannot navigate to an earlier Playable Article.
- [x] Active-Round server projections contain no opponent current article, live path, estimated distance, or hidden equivalent.
- [x] The HUD remains understandable without relying on blue/red color alone.
- [x] Two-socket integration tests cover serialization, simultaneous attempts, stale source state, Target Arrival, and player-specific projection secrecy.

## Blocked by

- [`duel-lifecycle/03`](./03-prepare-and-start-every-round.md)
- [`duel-lifecycle/05`](./05-create-authoritative-round-outcomes.md)

## Out of scope

- Backtracking, undo, bookmarks, or arbitrary search
- Optimistic client-authoritative path mutation
- Opponent article, route, distance, or spectator projections
- Opponent activity animation
- Post-Round comparison

## Comments

- 2026-07-12: Required opponent status is consolidated here because it shares the active player-specific projection seam with Navigation.

- 2026-10-01: Added server-validated Navigation with per-player serialization, canonical redirect handling, Target Arrival, private current articles, and the active Round HUD. Validation passed: 252 tests, typecheck, build, and lint. Standards and spec reviews have no remaining findings.
