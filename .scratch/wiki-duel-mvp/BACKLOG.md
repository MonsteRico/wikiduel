# Wiki Duel Scope Backlog

This portfolio index groups independently implementable tickets by the test milestone they support. Tickets live under their owning feature at `.scratch/<feature-slug>/tickets/`. `Scope` describes product priority; a ticket's `Status` separately describes whether it is specified well enough for implementation.

Planning stubs begin at `needs-triage`. Before assigning one to an implementation agent, grill that ticket until its behavior, acceptance criteria, boundaries, and blockers are settled, then move it to `ready-for-agent`. A feature can gain more numbered tickets as its design is refined. The Future architecture Epic is intentionally directional and should be split into concrete child tickets only after test evidence identifies real constraints.

## Scope definitions

- **MVP required**: needed for the first small-group playtest of a complete multi-round Duel.
- **MVP optional**: not needed for the first small-group test, but valuable before inviting a larger test group.
- **Future**: post-validation work aimed at turning the tested prototype into a released product.

## MVP required

- [`lobby/01`](../lobby/tickets/01-align-room-vocabulary-to-lobby.md) — align the product and planning corpus with canonical Lobby language
- [`test-automation/03`](../test-automation/tickets/03-standardize-tests-on-vitest.md) — establish Vitest across client and server
- [`test-automation/04`](../test-automation/tickets/04-strengthen-lobby-regression-coverage.md) — protect the implemented Lobby before transport refactoring
- [`realtime-transport/01`](../realtime-transport/tickets/01-extract-shared-websocket-transport.md) — provide one tested application-level realtime connection
- [`playable-articles/06`](../playable-articles/tickets/06-build-live-playable-article-foundation.md) — establish canonical safe text Article Documents and the live server boundary
- [`playable-articles/07`](../playable-articles/tickets/07-resolve-canonical-navigation-nodes.md) — classify internal links into canonical Navigation Nodes
- [`playable-articles/08`](../playable-articles/tickets/08-preserve-safe-attributed-figures.md) — preserve ordinary figures, captions, and image attribution
- [`playable-articles/09`](../playable-articles/tickets/09-add-repository-caching-and-resilience.md) — bound, coalesce, and cache complete article retrieval
- [`playable-articles/10`](../playable-articles/tickets/10-render-typed-article-documents.md) — render the production Article Document contract
- [`playable-articles/11`](../playable-articles/tickets/11-deliver-playable-article-lab.md) — deliver the development-only end-to-end article acceptance surface
- [`shared-contracts/01`](../shared-contracts/tickets/01-establish-shared-client-server-contracts.md) — establish the Zod-validated client/server contract seam; recommended next task
- [`duel-lifecycle/01`](../duel-lifecycle/tickets/01-establish-the-prompt-catalog.md) — provide the Prompt format, fixtures, selection, and Lobby history
- [`duel-lifecycle/02`](../duel-lifecycle/tickets/02-enter-the-first-duel.md) — enter the minimal authoritative Duel core
- [`duel-lifecycle/03`](../duel-lifecycle/tickets/03-prepare-and-start-every-round.md) — prepare and start first, later, and Rematch Rounds fairly
- [`duel-lifecycle/04`](../duel-lifecycle/tickets/04-apply-the-damage-rule.md) — isolate and verify the locked Damage Rule
- [`duel-lifecycle/05`](../duel-lifecycle/tickets/05-create-authoritative-round-outcomes.md) — freeze Rounds and apply authoritative damage
- [`duel-lifecycle/06`](../duel-lifecycle/tickets/06-navigate-and-show-the-active-round.md) — deliver Navigation, Target Arrival, the HUD, and private projections
- [`duel-lifecycle/07`](../duel-lifecycle/tickets/07-reveal-post-round-and-continue.md) — reveal routes and continue through later Rounds
- [`duel-lifecycle/08`](../duel-lifecycle/tickets/08-complete-the-duel-and-show-post-duel.md) — complete normal Duels and show Post-Duel
- [`duel-lifecycle/09`](../duel-lifecycle/tickets/09-rematch-or-return-to-the-lobby.md) — finish the repeat-play loop
- [`duel-lifecycle/10`](../duel-lifecycle/tickets/10-confirm-leave-duel-and-forfeit.md) — confirm departure and terminate by Forfeit cleanly
- [`prompt-pool/01`](../prompt-pool/tickets/01-author-the-initial-ten-prompts.md) — human-authored production Prompt seed required for manual play and deployment
- [`browser-support/01`](../browser-support/tickets/01-verify-firefox.md) — support the primary test browser
- [`deployment/01`](../deployment/tickets/01-deploy-the-first-test-build.md) — make the MVP reachable through Dokploy

Additional required implementation tickets can be added within the relevant feature as its scope grill resolves more slices. The complete required product boundary lives in [`spec.md`](./spec.md).

## MVP optional

- [`connection-resilience/01`](../connection-resilience/tickets/01-short-reconnect-window.md) — preserve a Duel through a brief same-browser disconnect
- [`test-automation/01`](../test-automation/tickets/01-deterministic-article-fixture-graph.md) — reusable offline article graph for deterministic tests
- [`playtest-data/01`](../playtest-data/tickets/01-persist-completed-duels.md) — store completed gameplay results outside process memory
- [`playtest-data/02`](../playtest-data/tickets/02-playtest-feedback-and-analytics.md) — capture feedback and aggregate playtest signals for a larger test
- [`lobby-invite-links/01`](../lobby-invite-links/tickets/01-shareable-lobby-invite-links.md) — join a Lobby from a shared URL
- [`how-to-play/01`](../how-to-play/tickets/01-how-to-play-guide.md) — explain the Duel inside the product
- [`player-display-names/01`](../player-display-names/tickets/01-player-display-names.md) — lightweight names without accounts
- [`prompt-pool/02`](../prompt-pool/tickets/02-expand-prompt-pool.md) — broaden the larger-test pool to 25–50 prompts
- [`duel-lifecycle/11`](../duel-lifecycle/tickets/11-add-the-fixed-time-limit.md) — add an optional fixed five-minute Time Limit
- [`duel-lifecycle/12`](../duel-lifecycle/tickets/12-show-opponent-activity.md) — add a subtle non-strategic activity signal
- [`duel-lifecycle/14`](../duel-lifecycle/tickets/14-show-a-forfeit-summary.md) — explain a forfeited Duel without treating it as normal completion
- [`duel-lifecycle/15`](../duel-lifecycle/tickets/15-enrich-the-post-duel-summary.md) — add best-path and fastest-arrival highlights
- [`accessibility/01`](../accessibility/tickets/01-accessibility-fundamentals-pass.md) — harden interaction for a broader audience
- [`browser-support/02`](../browser-support/tickets/02-verify-safari.md) — verify Safari behavior
- [`test-automation/02`](../test-automation/tickets/02-expand-automated-test-coverage.md) — add broader end-to-end and accessibility checks
- [`duel-lifecycle/13`](../duel-lifecycle/tickets/13-evaluate-and-tune-the-damage-rule.md) — revisit balance after first-test evidence

- [`playable-articles/02`](../playable-articles/tickets/02-render-infoboxes.md): preserve useful infobox media, facts, and Navigation Nodes

## Future

- [`connection-resilience/02`](../connection-resilience/tickets/02-cross-device-session-recovery.md)
- [`connection-resilience/03`](../connection-resilience/tickets/03-long-lived-lobbies.md)
- [`connection-resilience/04`](../connection-resilience/tickets/04-active-duel-recovery-after-restart.md)
- [`playable-articles/03`](../playable-articles/tickets/03-render-data-tables.md)
- [`playable-articles/04`](../playable-articles/tickets/04-render-galleries-and-maps.md)
- [`playable-articles/05`](../playable-articles/tickets/05-render-audio-and-video.md)
- [`playtest-data/03`](../playtest-data/tickets/03-automate-data-retention.md)
- [`playtest-data/04`](../playtest-data/tickets/04-playtest-dashboard-and-admin-tools.md)
- [`architecture-scaling/01`](../architecture-scaling/tickets/01-scale-and-evolve-the-architecture.md) — Future Epic for evidence-led stack and scaling work
- [`duel-lifecycle/16`](../duel-lifecycle/tickets/16-add-configurable-time-limits.md)
- [`prompt-pool/03`](../prompt-pool/tickets/03-generate-prompt-candidates.md)
- [`match-history/01`](../match-history/tickets/01-match-history.md)
- [`route-replay/01`](../route-replay/tickets/01-route-replay.md)
- [`shareable-results/01`](../shareable-results/tickets/01-shareable-results.md)
- [`player-profiles/01`](../player-profiles/tickets/01-player-profiles-and-statistics.md)
- [`mobile-layouts/01`](../mobile-layouts/tickets/01-mobile-layouts.md)
- [`accessibility/02`](../accessibility/tickets/02-formal-accessibility-conformance.md)
