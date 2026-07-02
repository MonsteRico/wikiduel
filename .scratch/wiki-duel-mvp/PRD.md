# Wiki Duel MVP PRD

Status: Implementation-ready
Date: 2026-06-18
Source design: [`MVP.md`](../../MVP.md)
Visual direction: [`aiUIMockups.png`](../../aiUIMockups.png)

## Product Objective

Build the smallest credible private 1v1 Wikipedia racing game that can answer:

> Does the duel format create enough tension, fairness, route discussion, and replay desire that players voluntarily start another duel?

The product is a desktop-only, English-Wikipedia MVP. It is a game prototype, not a general Wikipedia browser or a finished competitive platform.

## Success Signals

These metrics inform investment decisions; they do not automatically decide them.

- **Primary:** at least 40% started rematch rate among first duels that end normally through HP loss. A rematch counts only when both players request it and the next duel starts.
- **Secondary:** at least 20% of lobbies that complete a first normal duel complete three or more duels with the same pair.
- Observe whether players discuss route choices, attribute losses to decisions, and play without handholding.
- Track timeouts, forfeits, interruptions, completion, click counts, duration, prompt performance, and damage distribution without assigning additional MVP thresholds yet.

## Non-Goals

- Accounts, display names, profiles, friends, chat, public matchmaking, ranking, progression, cosmetics, monetization, spectators, replays, or shareable results
- Mobile layouts or support below 1024px
- Strong anti-cheat or prevention of external search/AI use
- Multiple Wikipedia languages
- Automatic prompt generation, a complete Wikipedia graph, shortest-path scoring, or a verified par
- Redis, multiple backend instances, active-duel recovery after server restart, or an admin UI
- Infoboxes, data tables, galleries, audio, video, list articles, date articles, or year articles
- Fixed round counts, category/difficulty lobby filters, custom timer durations, or selectable Damage Rules

## Domain Rules

Canonical terms live in [`CONTEXT.md`](../../CONTEXT.md).

### Duel

- A Lobby permanently pairs its host and guest for its lifetime. It never accepts replacement players.
- A Lobby can host successive rematch Duels for the same pair.
- Both players begin every Duel at 100 HP.
- A Duel has no fixed round count. It normally ends when damage reduces a player to 0 HP.
- HP is clamped at zero. A rematch resets both players to 100 HP.
- A Duel may instead end by Forfeit; forfeits preserve current HP and are reported separately from normal victories.
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

- The Damage Rule is global code, not a lobby or per-Duel setting. Store a rule/build version in analytics so results from releases remain interpretable.
- The server calculates damage and returns a labeled breakdown for display; the client never duplicates the formula.
- After a non-final Round, each player must select `Ready for Next Round`. Once both are ready, the server starts a shared three-second countdown.
- The final Round still shows normal path comparison. Each player may then continue independently to the post-Duel summary.

### Optional Time Limit

- The Lobby exposes one host-controlled toggle: a five-minute Round limit, enabled by default.
- The protocol models this as `roundTimeLimitSeconds: number | null` to permit future durations without a contract change.
- When the enabled limit expires before a Target Arrival, the Round is a draw, deals no damage, and freezes both paths.
- The official timer excludes countdowns and disconnect pauses.

### Navigation

- A Navigation is one server-validated move through an allowed link on the player's authoritative current article.
- Browser history and the displayed path are never Navigation controls.
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
- Render the simplified full main body, preserving headings, paragraphs, ordinary lists, valid links, and ordinary content images with captions.
- Exclude references, navboxes, edit controls, infoboxes, data tables, galleries, icons, maps, audio, and video.
- Images are ambient, visually subordinate, and non-navigational.
- Infoboxes and tables are high-potential post-MVP content experiments.

## Lobby Lifecycle

### Home and Join

- Home offers `Create Lobby`, `Join Lobby`, and `How to Play`.
- Lobby codes contain six unambiguous uppercase letters/digits, are case-insensitive on entry, and are unique among active lobbies.
- An invite URL prefills the code and shows a simple join confirmation before claiming the guest seat.
- There is no display-name setup. UI labels are `You` and `Opponent`, with a `Host` badge where needed.
- On join, the server issues an opaque, unguessable Player Session token. Store a per-Lobby token map in local storage and authenticate sockets with the relevant token.
- A Player Session has one active socket. A newer authenticated tab replaces the older tab; the older tab becomes read-only and explains that the session moved.

### Waiting Lobby

- Only the Host changes settings. Settings are editable only while no Duel is active.
- Any settings change clears both ready states.
- Both players must be ready, then the Host selects `Start Duel`.
- Round preparation begins; after both clients acknowledge rendering, the shared three-second countdown begins.
- The start article remains covered before and during preparation. Reveal start/target titles at countdown start and enable article content/Navigation at zero.
- The Lobby does not expose round count, difficulty, category, or arbitrary time settings.

### Leaving and Expiry

- Host sees `End Lobby`; guest sees `Leave Lobby`. Either explicit action immediately disbands the Lobby.
- Closing, refreshing, or losing connection while no Duel is active retains both seats for five minutes. If either player remains disconnected at expiry, disband the Lobby. Never admit a replacement.
- During a Duel, `Leave Duel` requires confirmation, records a Forfeit, disbands the Lobby, returns the departing player home, and shows the opponent a final forfeit summary.
- Server restart aborts active Lobbies/Duels and shows a clear interruption result when possible. Recovery is out of scope.

### Post-Duel

- Both `Rematch` requests automatically create another Duel with the same locked settings and a three-second start sequence.
- Either player selecting `Back to Lobby` returns both players, clears rematch intent, unlocks settings, and restores the initial ready/Host-start flow.
- Prompt history belongs to the Lobby. Do not repeat an enabled prompt across rematches until all enabled prompts have been used, then reshuffle.
- A new Lobby starts with the full enabled prompt pool, regardless of either browser's prior play.

## Connection and Fairness Rules

- Active Duel state is authoritative in one backend process.
- A disconnect pauses the Duel for both players, covers article content, disables Navigation, and freezes official elapsed time.
- Each player receives a cumulative 30-second interruption budget per Duel; reconnecting does not reset it.
- On reconnect, send a complete player-specific snapshot and resume after a shared three-second countdown.
- The snapshot and live projections must omit the opponent's current article and path during an active Round.
- If the budget expires, the disconnected player forfeits. Preserve both HP values.
- A connected client that cannot acknowledge prepared article rendering within the interruption budget also forfeits after a retry opportunity.
- Both clients must acknowledge that the start article rendered before a Round countdown begins.
- The connected player cannot read under preparation or disconnect overlays.

## Prompt Curation

- Store prompts in a version-controlled seed file and upsert them into Postgres during deployment. No admin UI.
- An ordered pair is one prompt. Never auto-generate the reverse direction; it requires separate curation.
- Required fields: stable ID, start title, target title, `easy | medium | hard` curator label, enabled flag, and optional notes.
- Difficulty is metadata only during the MVP and does not affect selection.
- Do not include `expected_min_clicks` or `par` in the MVP. Future par may use a graph or observed performance.
- Automated seed validation rejects duplicate ordered pairs, identical/collapsed endpoints, invalid difficulty, unresolved endpoints, and endpoints that are not Playable Articles.
- Human curation owns route quality, reachability, hub avoidance, and fun.
- Require at least 20 enabled prompts for closed friend testing and 50 before sharing a public link.
- If prompt preflight cannot resolve its start or target, skip it for the current server process, record an operational error, and choose another unused prompt. Do not mutate the seed record automatically.

## Screens and Interaction

Use the mockup's general composition and visual language, corrected for this PRD.

### Visual Direction

- Dark competitive shell around a light editorial article surface
- Stable blue/red player accents, bold HP/status hierarchy, restrained motion
- Wikipedia familiarity through typography, prose, headings, links, captions, and quiet images
- shadcn/ui supplies selected accessible behavior, not the product aesthetic; override default component styling
- Desktop layouts at 1024px and wider; smaller widths show an unsupported-device message

### Home/Lobby

- Create/join actions, invite/code controls, two player slots, readiness, Host badge, timer toggle, and explicit leave/end action
- No round-count or difficulty control
- `How to Play` modal accessible from home and Lobby

### Duel

- Current Round number, target, both HP values, your click count/path, opponent click count/connection status, and optional timer
- Do not show opponent current article, live path, estimated distance, or a path-view action
- A subtle nonessential pulse may indicate that the opponent navigated
- One-line rules reminder below the HUD

### Post-Round

- Winner/draw, damage and server-provided breakdown, start/target, both frozen paths, clicks, active elapsed times, and HP
- Non-final action is `Ready for Next Round`; the only exit is confirmed `Leave Duel`
- The route comparison is a primary product moment, not a generic stats table

### Post-Duel

- Winner/outcome reason, final HP, rounds won, damage by Round, each player's best completed path, and fastest Target Arrival
- Best path means fewest Navigations among that player's completed targets, with elapsed time as tie-breaker; omit it if they never arrived
- Actions: `Rematch`, `Back to Lobby`, and explicit end/leave. No Share Match MVP action.
- Optional, collapsible feedback must not block Rematch: fun 1-5, damage fairness 1-5, and optional frustration/confusion text

## Architecture

### Repository and Runtime

```text
apps/web          Vite + React + TypeScript
apps/server       Node.js + TypeScript + Fastify + Socket.IO
packages/contracts  Zod transport schemas and shared identifiers only
```

- npm workspaces, Node 24 LTS, strict TypeScript
- Tailwind CSS plus selectively restyled shadcn/ui primitives
- Zustand for client UI/projection state; no TanStack Query initially
- Postgres with Drizzle; migrations are committed and run before Fastify starts in the single-instance container
- ESLint flat config, Prettier, Vitest, and Playwright
- `@t3-oss/env-core` with Zod-backed validation and explicit Vite public-variable exposure

### Authority and Modules

- Keep lobby and Duel transitions in a transport-independent server core.
- Fastify/Socket.IO adapters authenticate commands, obtain external article data, invoke the core, persist results, and project player-specific updates.
- `packages/contracts` contains schemas and IDs, never Damage Rules or authoritative transitions.
- HTTP creates/joins Lobbies and returns bootstrap state/token. Authenticated Socket.IO owns settings, readiness, start, Navigation, round readiness, rematch, and all live updates.
- Do not create duplicate HTTP mutation paths for realtime commands.
- Reconnect sends a full player-specific snapshot, then incremental events.

### Persistence

- Keep active Lobby/Duel state in server memory on one instance (ADR-0001).
- Apply Navigation in memory and respond without waiting on Postgres.
- Persist path entries asynchronously; persist the authoritative Round summary and path transactionally at Round end.
- Persist prompts, completed results, navigation analytics, feedback, and a seven-day article cache.
- Cache canonical title, sanitized content, playable links, source revision, and fetch time.
- Exact-revision pinning within a Round is a future fairness improvement, not an MVP requirement.
- Store player tokens only in a non-reversible form server-side once Player Sessions are implemented.

### Deployment

- One multi-stage application image builds the Vite app and runs Fastify, which serves the SPA, HTTP, and Socket.IO from one origin.
- Postgres is the only separate service. Supply Docker Compose suitable for local infrastructure and Dokploy deployment.
- Local development may use separate explicit commands for Postgres and workspace dev servers; document them clearly.
- Application startup runs migrations before serving traffic and fails if migration or validated environment setup fails.
- Provide liveness and database-backed readiness endpoints.

### Wikipedia Boundary

- Put Wikipedia access behind an adapter so fixtures and live content are interchangeable.
- Production uses English Wikipedia, canonical redirects, server-side sanitization, and the seven-day Postgres cache.
- Automated tests use hand-authored offline fixtures initially. A future tool may generate and commit a fixed fixture graph from real revisions.
- Before implementing the live adapter, verify current Wikimedia API identification, request policy, CC BY-SA text attribution, and per-image license/attribution requirements from official sources. Attribution compliance is mandatory even though its exact UI remains a live-adapter design task.

## Security and Privacy

- Treat article HTML as untrusted; sanitize server-side with a strict allowlist and avoid arbitrary client HTML execution.
- Use same-origin sockets, security headers, request-size limits, join/create rate limits, opaque high-entropy tokens, and redacted structured logs.
- CSP initially permits self only; explicitly add only the Wikimedia media hosts needed by the live adapter.
- Analytics retain random Player Session IDs and gameplay/feedback events, not display names, IP addresses, invite tokens, or raw article HTML.
- Use no third-party analytics SDK.
- Retain raw gameplay events and free-text feedback for 90 days, then delete them; aggregate prompt/funnel metrics may remain.

## Accessibility and Browser Support

- Support latest stable Chrome, Edge, Firefox, and Safari on desktop.
- Keyboard-operable flows, visible focus, semantic article structure, labeled status/control updates, reduced motion, and non-color-only status cues are required.
- Target WCAG 2.2 AA fundamentals without claiming formal certification.

## Analytics Events

At minimum capture:

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

- Unit-test core transitions, Damage Rule boundaries, timeout draws, serialized Navigation, readiness, pause budgets, forfeits, and prompt selection.
- Integration-test Fastify/Socket.IO adapters, authentication, player-specific projections, persistence, migrations, cache behavior, and sanitization.
- Playwright-test two browser contexts for create/join, shared countdown, one fixture-backed Round, reconnect snapshot, route comparison, and rematch as those capabilities land.
- Live Wikipedia smoke tests are separate, minimal, and never required for deterministic CI.

## Goal Roadmap

1. **Project foundation:** scaffold the workspace, quality/tooling, web shell, server health/socket handshake, Postgres/Drizzle infrastructure, Docker, and CI. See [`issues/01-project-foundation.md`](./issues/01-project-foundation.md).
2. **Private Lobby pairing:** HTTP create/join, codes/invites, Player Session tokens, two-seat lifecycle, settings/readiness, player-specific socket snapshots, waiting disconnect expiry, and Lobby UI.
3. **Fixture-backed playable Round:** transport-independent Duel core, fixture article adapter, Playable Article renderer, authoritative Navigation, countdown/render acknowledgement, Target Arrival, hidden opponent projection, and route comparison.
4. **Live Wikipedia content:** official-policy verification, fetch/canonicalization, sanitization, page classification, images/attribution, seven-day Postgres cache, prompt seed/validation/preflight, and adapter smoke tests.
5. **Full HP Duel:** global Damage Rule and breakdown, variable Rounds, HP elimination, timer draw, next-Round readiness, final comparison, post-Duel summary, Lobby prompt history, rematch, and return-to-Lobby.
6. **Resilience and exits:** active pause overlays, cumulative interruption budget, reconnect snapshots/countdowns, duplicate-tab replacement, retry/forfeit flows, deliberate exit, and server-interruption UX.
7. **Playtest instrumentation:** durable event/summary writes, optional feedback, retention cleanup, prompt metrics, closed-test prompt pool, accessibility/browser pass, and Playwright critical flows.
8. **Public-test deployment:** 50-prompt gate, production Compose/Dokploy verification, CSP/rate limits/log redaction, operational runbook, and public-link smoke test.

Each goal should leave a runnable, tested increment. Goal 3 intentionally proves the core two-player experience with fixtures before live Wikipedia complexity enters the system.

## MVP Completion Criteria

The MVP is ready for closed testing when two desktop browsers can create/join a private Lobby, complete and rematch a full HP Duel over at least 20 curated live English-Wikipedia prompts, recover from brief disconnects, compare paths, submit optional feedback, and produce trustworthy first-party analytics. Public-link testing additionally requires 50 enabled prompts, the browser/accessibility/security pass, verified Wikimedia compliance, and a successful Dokploy smoke test.
