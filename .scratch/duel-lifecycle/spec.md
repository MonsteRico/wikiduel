# Duel Lifecycle spec

Status: ready-for-agent
Date: 2026-10-02
Parent: [Wiki Duel MVP spec](../wiki-duel-mvp/spec.md)
Architecture: [ADR 0003](../../docs/adr/0003-share-client-server-contracts-through-zod-schemas.md)

## Problem Statement

The implemented Duel ends each Round on its first Target Arrival. The first small-group MVP now requires both players to have the opportunity to arrive, with click counts deciding the winner and an optional Host-enabled deadline bounding active play. The rules below were confirmed in [ticket 17](./tickets/17-refine-click-scored-rounds.md) and are implemented by [ticket 18](./tickets/18-implement-click-scored-rounds.md).

## Solution

Extend the existing server-authoritative Duel core and shared contracts. Each Target Arrival freezes that player's route; both arrivals or Time Limit expiry create one immutable Round Outcome. Players compare routes Post-Round, repeat until zero HP, and then choose Rematch or return to their Lobby. Required departure and connection failures retain their existing terminal behavior.

## Agreed outcome rules

| Condition | Winner | Damage |
| --- | --- | --- |
| Both arrive, different clicks | Fewer clicks | `min(60, 25 + 3 * (loser clicks - winner clicks))` |
| Both arrive, equal clicks | Earlier server-accepted arrival | 25 |
| Expiry with one arrival | Player who arrived | 60 |
| Expiry with neither arrival | Draw | 0 |

- Completed-route damage ranges from 25 to 60. HP is clamped at zero. Draws preserve both HP values and do not end a Duel.
- Without a Time Limit, both arrivals are required. Do not end early because a player can no longer win on clicks.
- Server acceptance order breaks equal-click ties even when timestamps match. Client timestamps never determine the winner.
- The Host can toggle a fixed five-minute Time Limit in the Lobby only. It defaults off, is visible to both players, and changing it clears both readiness flags. The setting persists through later Rounds, Rematches, and Back to Lobby.
- The deadline is five minutes after active play starts, excluding preparation and countdown. Navigation must finish validation and be accepted strictly before expiry; expiry wins at the exact deadline. Check the deadline at acceptance even if the scheduled callback is late.
- Target Arrival freezes that player's route, clicks, and arrival elapsed time and locks further Navigation. They can read the target article and see their own frozen time while waiting. Both players see arrival status and opponent clicks, but no opponent article, path, estimated distance, or exact arrival time until Post-Round.
- The active Round clock shows remaining time with the Time Limit enabled or elapsed time otherwise. It remains distinct from an arrived player's frozen time.
- Post-Round reveals both frozen paths, clicks, and individual times, labels each "Target reached" or "Did not reach target," and explains the outcome reason. Unfinished routes show elapsed time at expiry, never an arrival time. Final-Round review retains this comparison.
- The existing Post-Duel summary must handle draws and new win reasons. Best-path and fastest-arrival highlights stay optional under ticket 15.
- Departure, disconnect, Forfeit, and Interruption rules remain unchanged, including while one player waits after arrival.

## User Stories

1. As a Host, I want to start a Duel only after both players are ready, so that neither player is pulled into play unexpectedly.
2. As a player, I want both players to begin every Duel at 100 HP, so that each Duel starts fairly.
3. As a player, I want both players to receive the same ordered Prompt, so that we race the same challenge.
4. As a player, I want unused Prompts selected across successive Rounds and Rematches, so that the Lobby does not immediately repeat content.
5. As the Prompt maintainer, I want a documented, validated seed format, so that I can author and maintain the production Prompt list myself.
6. As an implementation agent, I want deterministic Prompt fixtures, so that Duel work does not depend on production Prompt authorship.
7. As a player, I want the start Playable Article covered during preparation, so that I cannot inspect or navigate before my opponent is ready.
8. As a player, I want the Round countdown to wait for both clients to render, so that rendering speed does not decide the start.
9. As a player, I want a shared three-second countdown, so that the Round has an understandable beginning.
10. As a player, I want preparation to terminate clearly when a client cannot render in time, so that the Duel never hangs invisibly.
11. As a player, I want the active screen to show elapsed or remaining time according to the Lobby setting, so that the Round clock is clear.
12. As a player, I want Navigation to follow only valid Navigation Nodes from my authoritative current article, so that the race obeys Wikipedia links.
13. As a player, I want accepted Navigation to add exactly one canonical article and one click, so that my route is trustworthy.
14. As a player, I want invalid, stale, duplicate, or failed Navigation to leave my state unchanged, so that technical failures do not penalize me.
15. As a player, I want only one Navigation in flight, so that racing clicks cannot reorder my authoritative path.
16. As a player, I want my current path and click count visible but not usable as backtracking controls, so that I can understand my route without undoing it.
17. As a player, I want both completed routes compared by clicks, with arrival order breaking equal-click ties, so that route efficiency decides the Round.
18. As a player, I want to see my opponent's HP, click count, and connection state, so that the race has live tension.
19. As a player, I want my live article and route hidden from my opponent, so that they cannot copy my strategy.
20. As a player, I want the server to freeze both routes when the Round ends, so that later messages cannot rewrite the comparison.
21. As a player, I want the Damage Rule applied consistently from frozen click counts, so that HP loss is explainable.
22. As a player, I want damage clamped to the locked bounds, so that one Round cannot produce an unintended result.
23. As a player, I want both clients to receive the same labeled damage breakdown, so that neither client independently calculates the result.
24. As a player, I want the Round Outcome to include both paths, clicks, active times, damage, and resulting HP, so that we can discuss our choices.
25. As a player, I want Post-Round to distinguish the authoritative Round Outcome from presentation and readiness, so that the lifecycle remains unambiguous.
26. As a player, I want both players to opt into the next Round, so that route discussion is not interrupted.
27. As a player, I want every later Round to reuse the same preparation and countdown behavior, so that fairness does not degrade after Round one.
28. As a player, I want the Duel to continue without a fixed Round count, so that HP rather than an arbitrary count decides normal completion.
29. As a player, I accept that a Round waits indefinitely for both arrivals without a Time Limit, and that repeated no-arrival draws can continue a Duel when it is enabled.
30. As a player, I want the Duel to end immediately when a Round Outcome reduces either player to zero HP, so that completion is authoritative.
31. As a player, I want to inspect the final Post-Round comparison before seeing Post-Duel, so that the decisive routes remain the primary product moment.
32. As a player, I want the normal Post-Duel summary to show the winner, final HP, and damage by Round, so that I understand the Duel.
33. As a player, I want Rematch to require both players, so that a new Duel never starts unilaterally.
34. As a player, I want Rematch to reset HP and reuse the established Round preparation path, so that another Duel begins cleanly.
35. As a player, I want either player to return both players to the Lobby ready flow, so that the pair can stop without losing the Lobby.
36. As a player, I want explicit departure to require confirmation, so that browser or in-app navigation does not accidentally end the Duel.
37. As a remaining player, I want a clear opponent-left notice, so that a Forfeit never looks like a frozen Round.
38. As a player, I want connection loss during any Duel phase to terminate and disband exactly once, so that ghost Duels cannot remain active.
39. As a player, I want system preparation failures classified as Interruption rather than Forfeit or draw, so that outcome language remains honest.
40. As a Host, I want to enable a five-minute Time Limit before a Duel, so that each Round ends even if one or both players never arrive.

## Implementation Decisions

- The Duel lifecycle is the single planning owner for direct Duel behavior. Prompt content, Playable Article infrastructure, shared contracts, connection resilience, analytics, browser verification, and deployment remain separate capabilities.
- Extend the existing Shared Contracts module. Its strict Zod 4 schemas remain private sources of truth; callers consume inferred types and stable direction-specific decoder functions.
- Runtime message-shape validation remains separate from state, authorization, and transition rules in the authoritative Duel core.
- The Prompt Catalog is a server-side module that owns the seed format, loading, structural validation, selection, and Lobby-level used-Prompt history. Tests use deterministic fixtures. The human-maintained production seed is a separate ready-for-human checkpoint.
- The first Duel slice extracts only the minimal transport-independent core required to cross the implemented Lobby start seam. Later tracer bullets extend that same core rather than designing the entire lifecycle upfront.
- The authoritative lifecycle distinguishes at least preparation, countdown, active Round, Post-Round, and completed Duel behavior. Commands invalid for the current state are rejected without mutation.
- Initial 100 HP belongs to Duel creation. HP mutation belongs to Round Outcome creation. Post-Duel behavior reacts to a final zero-HP Round Outcome.
- Disconnect during any Duel phase immediately produces the required terminal Forfeit/disband invariant. Confirmed departure and browser-navigation UX are delivered separately.
- Every Round uses one reusable preparation path. Both clients acknowledge successful covered rendering before a shared server start time begins the three-second countdown.
- A fixed 30-second acknowledgement deadline begins after both clients receive the prepared Round. Expiry creates an Interruption, disbands the Lobby, assigns no winner, and enters no normal result flow.
- The active HUD derives elapsed or remaining time from authoritative Round timing and shows a player's frozen arrival time separately.
- The Damage Rule is an isolated pure module with a small interface that returns a labeled breakdown. It does not own HP initialization, Post-Round presentation, or Duel completion.
- Each Target Arrival freezes one player's route. The second arrival or expiry creates one immutable Round Outcome through the existing authoritative transition, applies the Damage Rule, updates HP, and identifies final versus non-final status. Freeze unfinished routes at the deadline, even if timer processing occurs later.
- Shared contracts need a Host setting command, visible Lobby setting, active deadline, per-player arrival status, private own arrival time, and outcome variants for two arrivals, sole arrival at expiry, and no-arrival draw. Round Outcome records retain both players' completion status and times. Winner identity and damage breakdown must represent draws and timeout wins without fabricated click differentials. Post-Duel summaries carry these reasons too.
- Keep opponent arrival times and routes out of active projections, rather than merely hiding them in the client. Arrival ordering belongs to authoritative state; the client does not decide tie order.
- Navigation and required opponent status form one vertical slice because they share player-specific active-Round projections. Opponent article, live path, and estimated distance never cross that seam.
- Post-Round is the synchronized presentation/readiness phase for a Round Outcome. A final Round still passes through Post-Round before each player may continue independently to Post-Duel.
- A non-final Round begins only after both players give one-way readiness and then reuses the established preparation path.
- A Rematch begins only after both players request it, resets HP, retains Lobby Prompt history, and reuses the established preparation path. Back to Lobby clears intent and restores readiness and Host-controlled start.
- Required Duels have no fixed Round count. Without a Time Limit, an unfinished Round waits for both arrivals or terminal departure; with a Time Limit, no-arrival draws can repeat without HP loss.
- Direct lifecycle polish and extensions remain in the same feature with independent Scope fields rather than returning to fragmented feature directories.

## Testing Decisions

- Tests assert observable behavior through module interfaces rather than internal data structures. A refactor behind a stable interface should not require behavioral tests to change.
- Shared Contracts tests exercise valid and malformed unknown values through the exported decoders, including strict objects and discriminated command/projection unions.
- Duel-core tests exercise authoritative transitions through the core interface with injected clocks, Prompt fixtures, and Playable Article adapters.
- Damage Rule tests cover completed-route differences of 0, 1, 11, 12, and larger, equal-click wins, sole-arrival maximum damage, zero-damage draws, labeled inputs, and HP clamping. Test the pure rule independently of timing and transport.
- Injected-clock core tests cover before/at/after-deadline acceptance, requests whose article resolution crosses expiry, same-timestamp arrival order, duplicate scheduling, stale callbacks, and cleanup after normal completion, Forfeit, Interruption, later Rounds, and Rematches.
- Server integration tests use two real test WebSockets to exercise commands, ordering, idempotence, state rejection, disconnection, and player-specific projections.
- Client feature tests use React Testing Library with the existing controllable WebSocket to exercise screens, actions, countdown/stopwatch behavior, hidden information, and terminal notices.
- A deterministic server integration regression completes a multi-round zero-HP Duel and starts a Rematch with reset HP and retained Lobby Prompt history.
- Required tests use small deterministic Prompt and Playable Article adapters. A reusable fixture-graph product and live Wikipedia checks remain separate.
- Full two-browser automation remains MVP optional.

## Out of Scope

- Implementing the tickets in this planning change
- Agent-authored or generated production Prompts
- Route verification, difficulty assignment, balance tuning, or automatic Prompt generation
- Custom Time Limit durations, speed scoring, or selecting winners from unfinished click counts
- Short reconnect windows, cross-device recovery, or active-Duel restart recovery
- Durable analytics, match history, route replay, profiles, rankings, sharing, or spectators
- Strong anti-cheat, latency compensation, or multiple backend instances
- Mobile support and formal accessibility conformance

## Further Notes

- Work the frontier recorded in [BACKLOG.md](./BACKLOG.md); blocking edges, not numeric order alone, determine what can start.
- The next gameplay implementation task is [ticket 18](./tickets/18-implement-click-scored-rounds.md), after deployment setup. It extends the existing contracts and Duel loop in one change.
- The human-maintained ten-Prompt seed blocks manual play and deployment, not agent implementation against deterministic fixtures.
- The broad MVP spec remains the product-level scope authority and links to this focused lifecycle plan.
