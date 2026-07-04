# Wiki Duel Scope Backlog

This portfolio index groups independently implementable issues by the test milestone they support. Issues live under their owning feature at `.scratch/<feature-slug>/issues/`. `Scope` describes product priority; an issue's `Status` separately describes whether it is specified well enough for implementation.

Planning stubs begin at `needs-triage`. Before assigning one to an implementation agent, grill that issue until its behavior, acceptance criteria, boundaries, and blockers are settled, then move it to `ready-for-agent`. A feature can gain more numbered issues as its design is refined. The Future architecture Epic is intentionally directional and should be split into concrete child issues only after test evidence identifies real constraints.

## Scope definitions

- **MVP required**: needed for the first small-group playtest of a complete multi-round Duel.
- **MVP optional**: not needed for the first small-group test, but valuable before inviting a larger test group.
- **Future**: post-validation work aimed at turning the tested prototype into a released product.

## MVP required

- [`lobby/01`](../lobby/issues/01-align-room-vocabulary-to-lobby.md) — align the product and planning corpus with canonical Lobby language
- [`test-automation/03`](../test-automation/issues/03-standardize-tests-on-vitest.md) — establish Vitest across client and server
- [`test-automation/04`](../test-automation/issues/04-strengthen-lobby-regression-coverage.md) — protect the implemented Lobby before transport refactoring
- [`realtime-transport/01`](../realtime-transport/issues/01-extract-shared-websocket-transport.md) — provide one tested application-level realtime connection
- [`playable-articles/06`](../playable-articles/issues/06-build-live-playable-article-foundation.md) — establish canonical safe text Article Documents and the live server boundary
- [`playable-articles/07`](../playable-articles/issues/07-resolve-canonical-navigation-nodes.md) — classify internal links into canonical Navigation Nodes
- [`playable-articles/08`](../playable-articles/issues/08-preserve-safe-attributed-figures.md) — preserve ordinary figures, captions, and image attribution
- [`playable-articles/09`](../playable-articles/issues/09-add-repository-caching-and-resilience.md) — bound, coalesce, and cache complete article retrieval
- [`playable-articles/10`](../playable-articles/issues/10-render-typed-article-documents.md) — render the production Article Document contract
- [`playable-articles/11`](../playable-articles/issues/11-deliver-playable-article-lab.md) — deliver the development-only end-to-end article acceptance surface
- [`prompt-pool/01`](../prompt-pool/issues/01-curate-first-ten-prompts.md) — supply the first-test prompt pool
- [`round-start/01`](../round-start/issues/01-enter-the-first-round.md) — extend the implemented Lobby into a live Duel
- [`round-start/02`](../round-start/issues/02-synchronize-round-preparation.md) — prepare both clients and begin with a shared countdown
- [`navigation/01`](../navigation/issues/01-navigate-and-track-the-player-path.md) — enforce forward-only article Navigation
- [`opponent-status/01`](../opponent-status/issues/01-show-live-opponent-status.md) — show only HP, clicks, and connection state during a Round
- [`round-time-limit/01`](../round-time-limit/issues/01-enforce-the-round-time-limit.md) — end stuck Rounds as no-damage draws
- [`damage/01`](../damage/issues/01-apply-hp-and-damage.md) — turn Round efficiency into Duel progress
- [`round-results/01`](../round-results/issues/01-compare-paths-after-each-round.md) — deliver the core route-discussion moment
- [`duel-rematch/01`](../duel-rematch/issues/01-complete-and-rematch-a-duel.md) — finish the HP loop and start another Duel
- [`forfeit-flow/01`](../forfeit-flow/issues/01-leave-and-forfeit-a-duel.md) — confirm departure and disband cleanly
- [`browser-support/01`](../browser-support/issues/01-verify-firefox.md) — support the primary test browser
- [`deployment/01`](../deployment/issues/01-deploy-the-first-test-build.md) — make the MVP reachable through Dokploy

Additional required implementation issues can be added within the relevant feature as its scope grill resolves more slices. The complete required product boundary lives in [`PRD.md`](./PRD.md).

## MVP optional

- [`connection-resilience/01`](../connection-resilience/issues/01-short-reconnect-window.md) — preserve a Duel through a brief same-browser disconnect
- [`test-automation/01`](../test-automation/issues/01-deterministic-article-fixture-graph.md) — reusable offline article graph for deterministic tests
- [`playtest-data/01`](../playtest-data/issues/01-persist-completed-duels.md) — store completed gameplay results outside process memory
- [`playtest-data/02`](../playtest-data/issues/02-playtest-feedback-and-analytics.md) — capture feedback and aggregate playtest signals for a larger test
- [`lobby-invite-links/01`](../lobby-invite-links/issues/01-shareable-lobby-invite-links.md) — join a Lobby from a shared URL
- [`how-to-play/01`](../how-to-play/issues/01-how-to-play-guide.md) — explain the Duel inside the product
- [`player-display-names/01`](../player-display-names/issues/01-player-display-names.md) — lightweight names without accounts
- [`prompt-pool/02`](../prompt-pool/issues/02-expand-prompt-pool.md) — broaden the larger-test pool to 25–50 prompts
- [`post-duel-summary/01`](../post-duel-summary/issues/01-enrich-the-post-duel-summary.md) — add best-path and fastest-arrival highlights
- [`opponent-status/02`](../opponent-status/issues/02-opponent-activity-pulse.md) — add a subtle non-strategic activity signal
- [`forfeit-flow/02`](../forfeit-flow/issues/02-show-a-forfeit-summary.md) — explain a forfeited Duel as a result
- [`accessibility/01`](../accessibility/issues/01-accessibility-fundamentals-pass.md) — harden interaction for a broader audience
- [`browser-support/02`](../browser-support/issues/02-verify-safari.md) — verify Safari behavior
- [`test-automation/02`](../test-automation/issues/02-expand-automated-test-coverage.md) — add broader end-to-end and accessibility checks
- [`damage/02`](../damage/issues/02-evaluate-and-tune-damage.md) — revisit balance after first-test evidence

- [`playable-articles/02`](../playable-articles/issues/02-render-infoboxes.md): preserve useful infobox media, facts, and Navigation Nodes

## Future

- [`connection-resilience/02`](../connection-resilience/issues/02-cross-device-session-recovery.md)
- [`connection-resilience/03`](../connection-resilience/issues/03-long-lived-lobbies.md)
- [`connection-resilience/04`](../connection-resilience/issues/04-active-duel-recovery-after-restart.md)
- [`playable-articles/03`](../playable-articles/issues/03-render-data-tables.md)
- [`playable-articles/04`](../playable-articles/issues/04-render-galleries-and-maps.md)
- [`playable-articles/05`](../playable-articles/issues/05-render-audio-and-video.md)
- [`playtest-data/03`](../playtest-data/issues/03-automate-data-retention.md)
- [`playtest-data/04`](../playtest-data/issues/04-playtest-dashboard-and-admin-tools.md)
- [`architecture-scaling/01`](../architecture-scaling/issues/01-scale-and-evolve-the-architecture.md) — Future Epic for evidence-led stack and scaling work
- [`round-time-limit/02`](../round-time-limit/issues/02-configurable-round-time-limits.md)
- [`match-history/01`](../match-history/issues/01-match-history.md)
- [`route-replay/01`](../route-replay/issues/01-route-replay.md)
- [`shareable-results/01`](../shareable-results/issues/01-shareable-results.md)
- [`player-profiles/01`](../player-profiles/issues/01-player-profiles-and-statistics.md)
- [`mobile-layouts/01`](../mobile-layouts/issues/01-mobile-layouts.md)
- [`accessibility/02`](../accessibility/issues/02-formal-accessibility-conformance.md)
