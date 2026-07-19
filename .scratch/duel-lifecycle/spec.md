# Duel Lifecycle spec

Status: ready-for-agent
Date: 2026-07-12
Parent: [Wiki Duel MVP spec](../wiki-duel-mvp/spec.md)
Architecture: [ADR 0003](../../docs/adr/0003-share-client-server-contracts-through-zod-schemas.md)

## Problem Statement

Wiki Duel can pair two Player Sessions in a Lobby and preview Playable Articles, but it cannot yet conduct the Duel that tests the product hypothesis. The current planning spreads Round preparation, Navigation, damage, Post-Round comparison, completion, Rematch, opponent status, timing, and Forfeit behavior across feature directories with overlapping ownership and stale dependencies. Implementers lack one authoritative lifecycle, one dependency frontier, and precise seams for extending the Duel safely.

## Solution

Build one server-authoritative Duel lifecycle behind a transport-independent core and expose it through shared, runtime-validated client/server contracts. Two players will enter a Duel from their Lobby, prepare and start each Round fairly, navigate the same Prompt, create an immutable Round Outcome on Target Arrival, lose HP through the Damage Rule, compare routes Post-Round, repeat until zero HP, and then choose Rematch or return to their Lobby. Required departure and connection failures terminate cleanly. Direct lifecycle extensions remain under this same owner but retain their MVP-optional or Future scope.

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
11. As a player, I want the active screen to show elapsed time, so that I know how long the Round has lasted without imposing a Time Limit.
12. As a player, I want Navigation to follow only valid Navigation Nodes from my authoritative current article, so that the race obeys Wikipedia links.
13. As a player, I want accepted Navigation to add exactly one canonical article and one click, so that my route is trustworthy.
14. As a player, I want invalid, stale, duplicate, or failed Navigation to leave my state unchanged, so that technical failures do not penalize me.
15. As a player, I want only one Navigation in flight, so that racing clicks cannot reorder my authoritative path.
16. As a player, I want my current path and click count visible but not usable as backtracking controls, so that I can understand my route without undoing it.
17. As a player, I want the first valid Target Arrival processed by the server to win, so that every Round has one authoritative winner.
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
29. As a player, I accept that repeated unfinished Rounds can continue indefinitely when Time Limits are not enabled, so that the required loop stays simple.
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
40. As a future tester, I want a fixed Time Limit to be addable through the Round Outcome seam, so that it can later replace the stopwatch with a remaining-time countdown without restructuring required gameplay.

## Implementation Decisions

- The Duel lifecycle is the single planning owner for direct Duel behavior. Prompt content, Playable Article infrastructure, shared contracts, connection resilience, analytics, browser verification, and deployment remain separate capabilities.
- A neutral Shared Contracts module is the next implementation task and a prerequisite to Duel state crossing the realtime seam. Its strict Zod 4 schemas are private sources of truth; callers consume inferred types and stable direction-specific decoder functions.
- Runtime message-shape validation remains separate from state, authorization, and transition rules in the authoritative Duel core.
- The Prompt Catalog is a server-side module that owns the seed format, loading, structural validation, selection, and Lobby-level used-Prompt history. Tests use deterministic fixtures. The human-maintained production seed is a separate ready-for-human checkpoint.
- The first Duel slice extracts only the minimal transport-independent core required to cross the implemented Lobby start seam. Later tracer bullets extend that same core rather than designing the entire lifecycle upfront.
- The authoritative lifecycle distinguishes at least preparation, countdown, active Round, Post-Round, and completed Duel behavior. Commands invalid for the current state are rejected without mutation.
- Initial 100 HP belongs to Duel creation. HP mutation belongs to Round Outcome creation. Post-Duel behavior reacts to a final zero-HP Round Outcome.
- Disconnect during any Duel phase immediately produces the required terminal Forfeit/disband invariant. Confirmed departure and browser-navigation UX are delivered separately.
- Every Round uses one reusable preparation path. Both clients acknowledge successful covered rendering before a shared server start time begins the three-second countdown.
- A fixed 30-second acknowledgement deadline begins after both clients receive the prepared Round. Expiry creates an Interruption, disbands the Lobby, assigns no winner, and enters no normal result flow.
- The required active HUD shows an elapsed stopwatch derived from the authoritative Round start. The MVP-optional fixed Time Limit later replaces that display with remaining time.
- The Damage Rule is an isolated pure module with a small interface that returns a labeled breakdown. It does not own HP initialization, Post-Round presentation, or Duel completion.
- Target Arrival creates one immutable Round Outcome through a reusable authoritative transition. It freezes both routes, clicks, and active times, applies the Damage Rule, updates HP, and identifies final versus non-final status.
- Navigation and required opponent status form one vertical slice because they share player-specific active-Round projections. Opponent article, live path, and estimated distance never cross that seam.
- Post-Round is the synchronized presentation/readiness phase for a Round Outcome. A final Round still passes through Post-Round before each player may continue independently to Post-Duel.
- A non-final Round begins only after both players give one-way readiness and then reuses the established preparation path.
- A Rematch begins only after both players request it, resets HP, retains Lobby Prompt history, and reuses the established preparation path. Back to Lobby clears intent and restores readiness and Host-controlled start.
- Required Duels have no fixed Round count and no Time Limit. Repeated unfinished Rounds may continue until the players continue or one leaves.
- Direct lifecycle polish and extensions remain in the same feature with independent Scope fields rather than returning to fragmented feature directories.

## Testing Decisions

- Tests assert observable behavior through module interfaces rather than internal data structures. A refactor behind a stable interface should not require behavioral tests to change.
- Shared Contracts tests exercise valid and malformed unknown values through the exported decoders, including strict objects and discriminated command/projection unions.
- Duel-core tests exercise authoritative transitions through the core interface with injected clocks, Prompt fixtures, and Playable Article adapters.
- Damage Rule tests cover the base calculation, both clamps, equal and negative click differentials, labeled inputs, and deterministic output.
- Server integration tests use two real test WebSockets to exercise commands, ordering, idempotence, state rejection, disconnection, and player-specific projections.
- Client feature tests use React Testing Library with the existing controllable WebSocket to exercise screens, actions, countdown/stopwatch behavior, hidden information, and terminal notices.
- A deterministic server integration regression completes a multi-round zero-HP Duel and starts a Rematch with reset HP and retained Lobby Prompt history.
- Required tests use small deterministic Prompt and Playable Article adapters. A reusable fixture-graph product and live Wikipedia checks remain separate.
- Full two-browser automation remains MVP optional.

## Out of Scope

- Implementing the tickets in this planning change
- Agent-authored or generated production Prompts
- Route verification, difficulty assignment, balance tuning, or automatic Prompt generation
- A required Time Limit, configurable Time Limits, or timeout winner selection
- Short reconnect windows, cross-device recovery, or active-Duel restart recovery
- Durable analytics, match history, route replay, profiles, rankings, sharing, or spectators
- Strong anti-cheat, latency compensation, or multiple backend instances
- Mobile support and formal accessibility conformance

## Further Notes

- Work the frontier recorded in [BACKLOG.md](./BACKLOG.md); blocking edges, not numeric order alone, determine what can start.
- The next implementation task is the shared-contracts prerequisite recorded outside this feature.
- The human-maintained ten-Prompt seed blocks manual play and deployment, not agent implementation against deterministic fixtures.
- The broad MVP spec remains the product-level scope authority and links to this focused lifecycle plan.
