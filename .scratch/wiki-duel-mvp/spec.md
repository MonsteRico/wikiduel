# Wiki Duel MVP spec

Status: Scope-refined
Date: 2026-07-03
Historical source design: [`MVP-old.md`](../../MVP-old.md)
Visual direction: [`aiUIMockups.png`](../../aiUIMockups.png)
Focused Duel plan: [Duel Lifecycle spec](../duel-lifecycle/spec.md)

## Product Objective

Build the smallest credible private 1v1 Wikipedia racing game that can answer:

> Does the duel format create enough tension, fairness, route discussion, and replay desire that players voluntarily start another duel?

The product is a desktop-only, English-Wikipedia MVP. It is a game prototype, not a general Wikipedia browser or a finished competitive platform.

Scope is organized by test milestone. **MVP required** means necessary for the first small-group playtest; **MVP optional** means valuable before a larger-group test; **Future** means post-validation work toward a released product. The categorized ticket index is [`BACKLOG.md`](./BACKLOG.md).

## Current Implementation Baseline

The repository already has separate Vite/React and Fastify/TypeScript packages connected by a native WebSocket protocol. It implements server health, connection status, five-character Lobby creation/join, two fixed seats, readiness, Host-controlled start, copy-code UI, explicit Lobby departure, and Lobby closure when a paired player disconnects. The server emits `game-started`, but no Round, Playable Article, Navigation, HP, comparison, post-Duel, or Rematch flow exists yet.

New MVP work extends this baseline rather than restructuring it to match the original proposed stack.

## Success Signals

The first small-group test is evaluated through direct observation, conversation, and manual notes. It should establish whether players can complete the flow, understand Navigation and damage, discuss route choices, and voluntarily request another Duel without handholding. No durable analytics implementation or numeric threshold blocks MVP completion.

For a later larger-group test, MVP-optional analytics may evaluate:

- At least 40% started Rematch rate among first Duels that end normally through HP loss. A Rematch counts only when both players request it and the next Duel starts.
- At least 20% of Lobbies that complete a first normal Duel complete three or more Duels with the same pair.
- Timeouts, forfeits, interruptions, completion, click counts, duration, prompt performance, and damage distribution.

## Non-Goals

- Accounts, profiles, friends, chat, public matchmaking, ranking, progression, cosmetics, monetization, spectators, replays, or shareable results
- Mobile layouts or support below 1024px
- Strong anti-cheat or prevention of external search/AI use
- Multiple Wikipedia languages
- Automatic prompt generation, a complete Wikipedia graph, shortest-path scoring, or a verified par
- Postgres as a first-test dependency, Redis, multiple backend instances, active-duel recovery after server restart, or an admin UI
- Cross-device recovery and long-lived Lobbies
- Data tables, galleries, maps, audio, video, list articles, date articles, or year articles
- Fixed round counts, category/difficulty lobby filters, custom timer durations, or selectable Damage Rules

## Domain Rules

Canonical terms live in [`CONTEXT.md`](../../CONTEXT.md).

### Duel

- A Lobby permanently pairs its host and guest for its lifetime. It never accepts replacement players.
- A Lobby can host successive rematch Duels for the same pair.
- Both players begin every Duel at 100 HP.
- A Duel has no fixed round count. It normally ends when damage reduces a player to 0 HP.
- HP is clamped at zero. A rematch resets both players to 100 HP.
- A Duel may instead terminate by Forfeit. Required-MVP Forfeits disband the Lobby and do not enter the normal post-Duel result flow.
- Host is always blue and guest is always red on both clients. Text and icons also identify `You` and `Opponent`.

### Round

- Both players receive the same ordered start/target prompt.
- The first valid Target Arrival processed by the authoritative server wins and ends the Round immediately.
- Client timestamps never determine the winner. Network latency is an accepted MVP limitation.
- Both paths, click counts, and active elapsed times freeze at Round end.
- The MVP Damage Rule is:

```text
damage = 25 + 3 * (loser_clicks - winner_clicks)
damage = clamp(damage, 15, 60)
```

- This formula is locked for the first small-group MVP test. Evidence-led tuning is MVP optional afterward.

- The Damage Rule is global code, not a Lobby or per-Duel setting. If durable analytics are added, store a rule/build version so results from releases remain interpretable.
- The server calculates damage and returns a labeled breakdown for display; the client never duplicates the formula.
- After a non-final Round, each player must select `Ready for Next Round`. Once both are ready, the server starts a shared three-second countdown.
- The final Round still shows normal path comparison. Each player may then continue independently to the post-Duel summary.

### Time Limit

- Required-MVP Rounds have no Time Limit. The active Duel HUD shows elapsed stopwatch time derived from the authoritative Round start.
- Repeated unfinished Rounds may continue indefinitely when both players keep choosing to continue; either player may use the confirmed Leave Duel flow.
- A fixed five-minute Time Limit is MVP optional. When implemented, it replaces the stopwatch with remaining time and creates a no-damage draw if it expires before Target Arrival.
- The official timer excludes pre-Round countdowns. The MVP-optional reconnect feature owns any later pause behavior.
- Configurable durations are Future work that depends on the fixed Time Limit and evidence that one duration is insufficient.

### Navigation

- A Navigation is one server-validated move through an allowed link on the player's authoritative current article.
- Browser history and the displayed path are never Navigation controls.
- Browser Back during an active Duel is a leave attempt, not a return to an earlier article. Confirm the departure when the client can intercept it; closing, reloading, or losing connection causes the required terminal Forfeit/disband behavior.
- Revisiting an article is allowed only when the current article contains a valid link to it.
- Redirects resolve within the same Navigation. Record and display only the canonical destination; a redirect costs one click.
- Failed fetches, invalid links, stale requests, and duplicate requests do not consume a click or change the path.
- Allow only one Navigation in flight per player. The client disables links while it resolves, and the server rejects a request whose source no longer matches authoritative state.
- Non-playable anchors remain visible as plain text so prose remains readable.

### Playable Articles

- Use English Wikipedia main-namespace, existing, canonical articles only.
- Disambiguation pages are never playable.
- Exclude list articles, calendar-year articles, and calendar-date articles for the MVP.
- Exclude external, edit, help, file, category, talk, special, search, red, citation, and in-page footnote links.
- Render the simplified full main body, preserving headings, paragraphs, ordinary lists, valid links, and ordinary content images with captions. These are all required MVP content.
- Exclude references, navboxes, edit controls, infoboxes, data tables, galleries, icons, maps, audio, and video.
- Images are ambient, visually subordinate, and non-navigational. Their presence is required to break up long article text.
- Infoboxes are an MVP-optional article-content feature; data tables, galleries, maps, audio, and video are Future features.

## Lobby Lifecycle

### Home and Join

- Home offers `Create Lobby` and `Join Lobby`. An in-app `How to Play` guide is MVP optional.
- Lobby codes contain five unambiguous uppercase letters/digits, are case-insensitive on entry, and are unique among active Lobbies.
- The required MVP shares the code directly. Shareable invite URLs are MVP optional.
- Required-MVP UI labels are `You` and `Opponent`, with a `Host` badge where needed. Anonymous display names are MVP optional; accounts and persistent profiles are Future.
- The required MVP binds each Player Session to its active connection. Reclaiming a seat after connection loss belongs to the separately tracked short reconnect feature.

### Waiting Lobby

- Both players must be ready, then the Host selects `Start Duel`.
- Round preparation begins; after both clients acknowledge rendering, the shared three-second countdown begins.
- The start article remains covered before and during preparation. Reveal start/target titles at countdown start and enable article content/Navigation at zero.
- The Lobby does not expose round count, difficulty, category, or arbitrary time settings.

### Leaving and Expiry

- Host sees `End Lobby`; guest sees `Leave Lobby`. Either explicit action immediately disbands the Lobby.
- In the required MVP, closing, refreshing, or losing connection disbands a waiting Lobby. The optional short reconnect feature may retain both seats briefly; never admit a replacement.
- During a Duel, `Leave Duel` requires confirmation, causes a Forfeit, disbands the Lobby, and returns the departing player home. The remaining player sees `Opponent left`; a richer Forfeit summary is MVP optional.
- Server restart aborts active Lobbies/Duels and shows a clear interruption result when possible. Recovery is out of scope.

### Post-Duel

- Both `Rematch` requests automatically create another Duel with a three-second start sequence.
- Either player selecting `Back to Lobby` returns both players, clears rematch intent, and restores the initial ready/Host-start flow.
- Prompt history belongs to the Lobby. Do not repeat an enabled prompt across rematches until all enabled prompts have been used, then reshuffle.
- A new Lobby starts with the full enabled prompt pool, regardless of either browser's prior play.

## Connection and Fairness Rules

- Active Duel state is authoritative in one backend process.
- The required MVP ends an active Duel immediately by Forfeit and disbands the Lobby when a player disconnects. The remaining player sees `Opponent left` rather than a post-Duel result.
- One short, fixed same-browser reconnect window is an MVP-optional resilience feature tracked separately. It is not part of MVP completion.
- Live projections must omit the opponent's current article, path, and estimated distance during an active Round.
- If the optional reconnect window is implemented, expiry causes the same terminal Forfeit behavior.
- Both clients must acknowledge that the start article rendered before a Round countdown begins.
- The connected player cannot read under preparation or disconnect overlays.

## Prompt Curation

- Store prompts in a version-controlled seed file and load them into memory at startup. Durable prompt storage is not required for the first small-group test.
- An ordered pair is one prompt. Never auto-generate the reverse direction; it requires separate curation.
- Required fields: stable ID, start title, target title, `easy | medium | hard` curator label, enabled flag, and optional notes.
- Difficulty is metadata only during the MVP and does not affect selection.
- Do not include `expected_min_clicks` or `par` in the MVP. Future par may use a graph or observed performance.
- Automated seed validation rejects duplicate ordered pairs, identical/collapsed endpoints, invalid difficulty, unresolved endpoints, and endpoints that are not Playable Articles.
- Human curation owns route quality, reachability, hub avoidance, and fun.
- Require ten enabled prompts for the first small-group test. Expanding to 25–50 prompts is MVP optional before a larger-group test.
- If prompt preflight cannot resolve its start or target, skip it for the current server process, record an operational error, and choose another unused prompt. Do not mutate the seed record automatically.

## Screens and Interaction

Use the mockup's general composition and visual language, corrected for this spec.

### Visual Direction

- Dark competitive shell around a light editorial article surface
- Stable blue/red player accents, bold HP/status hierarchy, restrained motion
- Wikipedia familiarity through typography, prose, headings, links, captions, and quiet images
- The existing custom Tailwind component system supplies the product aesthetic and reusable controls.
- Desktop layouts at 1024px and wider; smaller widths show an unsupported-device message

### Home/Lobby

- Create/join and copy-code controls, two player slots, readiness, Host badge, and explicit leave/end action. Invite-link controls are MVP optional.
- No round-count or difficulty control
- An MVP-optional `How to Play` guide may be accessible from home and Lobby.

### Duel

- Current Round number, target, both HP values, your display-only click count/path, opponent click count/connection status, and active Round clock
- The required clock shows elapsed stopwatch time; the MVP-optional fixed Time Limit replaces it with remaining time.
- Never show the opponent's current article, live path, estimated distance, or a path-view action during a Round. These are intentionally hidden, not planned Future features.
- A subtle opponent-Navigation pulse is MVP optional.
- One-line rules reminder below the HUD

### Post-Round

- Winner/draw, damage and server-provided breakdown, start/target, both frozen paths through each player's final article, clicks, active elapsed times, and HP
- Non-final action is `Ready for Next Round`; the only exit is confirmed `Leave Duel`
- The route comparison is a primary product moment, not a generic stats table

### Post-Duel

- Required: winner/outcome reason, final HP, damage by Round, `Rematch`, `Back to Lobby`, and explicit end/leave.
- MVP optional: rounds won, each player's best completed path, fastest Target Arrival, and collapsible feedback that never blocks Rematch.
- If implemented, best path means fewest Navigations among that player's completed targets, with elapsed time as tie-breaker; omit it if they never arrived.
- Match history, route replay, shareable results, and profile statistics are Future.

## Architecture

### Repository and Runtime

```text
wikiduel-client   Vite + React + TypeScript + React Router + Tailwind CSS
wikiduel-server   Node.js + TypeScript + Fastify + @fastify/websocket
```

- Keep the existing client and server application packages. Add only the neutral shared-contracts workspace required by [ADR 0003](../../docs/adr/0003-share-client-server-contracts-through-zod-schemas.md).
- Keep the existing semantic Tailwind tokens and custom reusable UI primitives documented in the client design system.
- Keep React context and local state until demonstrated complexity justifies another client-state library.
- Use the existing native WebSocket protocol; Socket.IO is not an MVP migration target.
- Keep the current package-level TypeScript, lint, build, and server test tooling.
- No database is required for the first small-group test. Postgres with Drizzle is the preferred MVP-optional persistence path when durable completed-Duel records are needed.
- New libraries or repository restructuring must solve an observed requirement rather than align the implementation with the earlier proposed stack.

### Authority and Modules

- Keep lobby and Duel transitions in a transport-independent server core.
- Fastify WebSocket handlers receive commands, obtain external article data, invoke authoritative transitions, and project player-specific updates.
- Serialized Playable Article and realtime messages use the neutral shared-contracts module. Private strict Zod 4 schemas infer exported types and stable direction-specific decoders; runtime shape validation remains separate from server state and authorization rules.
- Realtime commands own Lobby creation/join, readiness, start, Navigation, round readiness, rematch, and live updates; do not add duplicate HTTP mutation paths without a concrete need.
- A full reconnect snapshot belongs to the separately tracked MVP-optional reconnect feature.

### Persistence

- Keep active Lobby/Duel state in server memory on one instance.
- Keep prompt selection and article caching in memory for the required MVP. Cache canonical title, sanitized content, playable links, source revision, and fetch time for the life of the process.
- Emit structured operational logs sufficient to diagnose first-test failures and inspect basic Duel outcomes.
- Persisted completed-Duel records, paths, feedback, rematch analytics, and a restart-surviving article cache are MVP optional for a larger-group test.
- Active-Duel recovery, retention automation, dashboards, and admin tools are Future.
- Exact-revision pinning within a Round is a Future fairness improvement.
- If recoverable Player Session credentials are introduced later, store them only in a non-reversible form server-side.

### Deployment

- One multi-stage application image builds the Vite app and runs Fastify, which serves the SPA, HTTP, and realtime connection from one origin.
- The required MVP deploys without a separate database service. Supply a container setup suitable for Dokploy deployment.
- Dokploy deployment is required for the first small-group test because it is how testers will access the game.
- Local development commands must be documented clearly.
- Provide liveness and application readiness endpoints. Database readiness becomes relevant only when optional persistence is added.

### Wikipedia Boundary

- Put Wikipedia access behind an adapter so fixtures and live content are interchangeable.
- Use the TypeScript `wikipedia` package as the initial API client behind that adapter. Confirm its required behavior during implementation and use direct official Wikimedia REST calls inside the adapter where the wrapper is insufficient.
- Production uses English Wikipedia, canonical redirects, server-side sanitization, and an in-memory article cache. A restart-surviving cache is MVP optional.
- Send a meaningful identifying User-Agent on Wikimedia requests.
- A hand-authored deterministic fixture graph is MVP optional. Required tests may use smaller test doubles without delivering a reusable fixture-backed gameplay mode.
- Before implementing the live adapter, verify current Wikimedia API identification, request policy, CC BY-SA text attribution, and per-image license/attribution requirements from official sources. Attribution compliance is mandatory even though its exact UI remains a live-adapter design task.

## Security and Privacy

- Treat article HTML as untrusted; sanitize server-side with a strict allowlist and avoid arbitrary client HTML execution.
- Use same-origin sockets, security headers, request-size limits, join/create rate limits, opaque high-entropy tokens, and redacted structured logs.
- CSP initially permits self only; explicitly add only the Wikimedia media hosts needed by the live adapter.
- Required structured logs must not retain display names, IP addresses, credentials, or raw article HTML.
- Optional durable analytics use random Player Session IDs and no third-party analytics SDK.
- Automated retention policy enforcement is Future work required before treating the prototype as a released product.

## Accessibility and Browser Support

- The required first-test MVP targets current desktop Firefox and Chromium at 1024px and wider. Firefox is the primary development and playtest browser.
- Before a larger-group test, MVP-optional work verifies Safari and adds keyboard-operable flows, visible focus, semantic article structure, labeled status/control updates, reduced-motion support, and non-color-only status cues.
- Mobile layouts and formal accessibility conformance work are Future.

## MVP-Optional Analytics Events

For a larger-group test, capture at minimum:

```text
lobby_created, lobby_joined, lobby_disbanded
duel_started, duel_completed, duel_forfeited, duel_interrupted
round_started, round_completed, round_timed_out
target_arrived, player_disconnected, player_reconnected
rematch_requested, rematch_started
feedback_submitted
```

Round records include prompt, winner/draw, paths, clicks, active duration, pause duration, final page, damage inputs/breakdown/result, and app/Damage Rule version. Duel records include duration, rounds, final HP, outcome reason, rematch intent/start, and interruption/forfeit reason.

## Test Strategy

- Add focused tests for risky authoritative rules: core transitions, Damage Rule boundaries, serialized Navigation, readiness, forfeits, preparation Interruption, and Prompt selection. Timeout-draw coverage lands with the MVP-optional Time Limit.
- Integration-test Fastify WebSocket behavior, player-specific projections, in-memory cache behavior, and sanitization using the existing server test tooling. Persistence and migration tests land with optional durable storage.
- Broader two-browser end-to-end and automated accessibility coverage is MVP optional before a larger-group test. Required slices may still add narrow regression tests for risky authoritative rules.
- Live Wikipedia smoke tests are separate, minimal, and never required for deterministic CI.

## Required MVP Implementation Sequence

The current private Lobby is the implemented baseline. Remaining work is split into narrow tickets that can be grilled and assigned independently:

1. [`lobby/01`](../lobby/tickets/01-align-room-vocabulary-to-lobby.md) — align the product and planning corpus with canonical Lobby language.
2. [`test-automation/03`](../test-automation/tickets/03-standardize-tests-on-vitest.md) — establish Vitest across client and server.
3. [`test-automation/04`](../test-automation/tickets/04-strengthen-lobby-regression-coverage.md) — protect implemented Lobby behavior before transport refactoring.
4. [`realtime-transport/01`](../realtime-transport/tickets/01-extract-shared-websocket-transport.md) — provide one tested application-level realtime connection.
5. [`playable-articles/06`](../playable-articles/tickets/06-build-live-playable-article-foundation.md) — establish the live-content boundary and safe text Article Documents.
6. [`playable-articles/07`](../playable-articles/tickets/07-resolve-canonical-navigation-nodes.md) — classify internal links into canonical Navigation Nodes.
7. [`playable-articles/08`](../playable-articles/tickets/08-preserve-safe-attributed-figures.md) — preserve safe ordinary figures, captions, and image attribution.
8. [`playable-articles/09`](../playable-articles/tickets/09-add-repository-caching-and-resilience.md) — make article retrieval bounded, coalesced, and process-cached.
9. [`playable-articles/10`](../playable-articles/tickets/10-render-typed-article-documents.md) — render typed Article Documents through production React components.
10. [`playable-articles/11`](../playable-articles/tickets/11-deliver-playable-article-lab.md) — deliver the development-only end-to-end acceptance surface.
11. [`shared-contracts/01`](../shared-contracts/tickets/01-establish-shared-client-server-contracts.md) — establish the Zod-validated client/server contract seam; this is the next task.
12. [`duel-lifecycle/01`](../duel-lifecycle/tickets/01-establish-the-prompt-catalog.md) — establish the Prompt format, validation, fixtures, selection, and Lobby history.
13. [`duel-lifecycle/02`](../duel-lifecycle/tickets/02-enter-the-first-duel.md) — cross the implemented Lobby seam into the minimal authoritative Duel core.
14. [`duel-lifecycle/03`](../duel-lifecycle/tickets/03-prepare-and-start-every-round.md) — reuse fair preparation, acknowledgement, countdown, and stopwatch behavior.
15. [`duel-lifecycle/04`](../duel-lifecycle/tickets/04-apply-the-damage-rule.md) — isolate and verify the locked Damage Rule.
16. [`duel-lifecycle/05`](../duel-lifecycle/tickets/05-create-authoritative-round-outcomes.md) — freeze a Round and apply damage through one transition.
17. [`duel-lifecycle/06`](../duel-lifecycle/tickets/06-navigate-and-show-the-active-round.md) — deliver Navigation, Target Arrival, active HUD, and private projections.
18. [`duel-lifecycle/07`](../duel-lifecycle/tickets/07-reveal-post-round-and-continue.md) — reveal routes and loop through later Rounds.
19. [`duel-lifecycle/08`](../duel-lifecycle/tickets/08-complete-the-duel-and-show-post-duel.md) — preserve the final comparison and show normal completion.
20. [`duel-lifecycle/09`](../duel-lifecycle/tickets/09-rematch-or-return-to-the-lobby.md) — complete the repeat-play loop.
21. [`duel-lifecycle/10`](../duel-lifecycle/tickets/10-confirm-leave-duel-and-forfeit.md) — complete explicit departure and terminal Forfeit UX.
22. [`prompt-pool/01`](../prompt-pool/tickets/01-author-the-initial-ten-prompts.md) — human-authored production Prompt seed; blocks manual play and deployment, not agent implementation.
23. [`browser-support/01`](../browser-support/tickets/01-verify-firefox.md) — verify the primary test browser.
24. [`deployment/01`](../deployment/tickets/01-deploy-the-first-test-build.md) — make the build available to testers.

Some tickets can overlap after their blockers land; dependency fields in the ticket files are authoritative. MVP-optional and Future work are indexed separately in [`BACKLOG.md`](./BACKLOG.md).

## MVP Completion Criteria

The MVP is ready for its first small-group test when two remote desktop Firefox/Chromium browsers can access the Dokploy deployment, create/join a private Lobby, complete and rematch a full HP Duel over ten maintainer-authored live English-Wikipedia Prompts, compare paths, and produce useful structured diagnostic logs. A Time Limit, durable analytics, feedback collection, a short reconnect window, and a larger Prompt pool improve a later larger-group test but do not block this milestone.
