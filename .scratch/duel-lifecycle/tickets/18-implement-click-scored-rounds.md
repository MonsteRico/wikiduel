# Implement click-scored Rounds and the Host-toggleable Time Limit

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent and delivery

- [Approved planning, duel-lifecycle/17](./17-refine-click-scored-rounds.md)
- [Duel Lifecycle spec](../spec.md)
- [Wiki Duel MVP spec](../../wiki-duel-mvp/spec.md)

Implement the complete approved gameplay change on `codex/17-refine-click-scored-rounds` in the main working directory. The planning chat creates this ticket and reconciles documentation; a subsequent implementation continues on the same branch. Do not create a worktree. This ticket replaces the old standalone timer proposal in ticket 11.

## Outcome and Damage Rule

The first Target Arrival no longer ends a Round. Freeze that player's route, clicks, and arrival elapsed time, then wait for the other arrival or an enabled deadline. Do not end early when one player cannot win on clicks.

| Condition | Winner | Damage |
| --- | --- | --- |
| Both arrive, different clicks | Fewer clicks | `min(60, 25 + 3 * (loser clicks - winner clicks))` |
| Both arrive, equal clicks | Earlier server-accepted arrival | 25 |
| Expiry with exactly one arrival | Player who arrived | 60 |
| Expiry with neither arrival | Draw | 0 |

Completed-route damage has a minimum of 25 and maximum of 60. The sole-arrival case ignores unfinished click counts. Draws preserve HP. Clamp losing HP at zero, retaining the existing distinction between calculated damage and actual HP loss. Only a zero-HP outcome ends a Duel normally.

Arrival order is server acceptance order after article validation, including when timestamps are identical. Never use client timestamps or seat identity to break ties. Both arrivals must occur before expiry when a Time Limit is enabled.

## Timer and Lobby settings

- Provide a Host-only five-minute on/off toggle, default off for a new Lobby. Both players see its value before readying.
- A changed value clears both readiness flags. Reject guest changes and changes outside the waiting Lobby without mutation. No change can affect an active or completed Duel.
- Retain the setting through later Rounds, Rematches, and Back to Lobby. Starting a new Lobby restores the off default.
- Each enabled Round has one authoritative deadline, five minutes after active play begins. Preparation and the shared countdown consume none of this time.
- Navigation must finish validation and be accepted strictly before the deadline. At the exact deadline, expiry wins. A request begun earlier but resolved at or after expiry cannot add a click, append a path, or create a Target Arrival.
- Check deadline eligibility at acceptance even if the scheduled callback runs late. Freeze unfinished times at the deadline rather than callback execution time.
- Publish one immutable outcome and mutate HP once. Cancel or invalidate timers and pending Navigation after Round completion, Forfeit, or Interruption. Stale callbacks must not affect later Rounds or Rematches.
- With the toggle off, no active deadline exists; both arrivals are required. Existing confirmed departure and immediate-disconnect Forfeit behavior still applies.

## Waiting, privacy, and review

- An arrived player cannot navigate further. They may read the target article and see their own frozen arrival time while waiting.
- Both players see arrival status and the existing live opponent click count, HP, and connection state. Active messages omit opponent article, route, estimated distance, and exact arrival time. Do not merely hide those fields in the UI.
- Show shared remaining time when enabled and elapsed Round time otherwise. Keep the Round clock distinct from the player's frozen arrival time.
- Post-Round shows both frozen paths and click counts. Label routes "Target reached" or "Did not reach target." Show each arrival elapsed time; unfinished routes show elapsed time at expiry without claiming an arrival.
- Explain fewer clicks, earlier arrival on equal clicks, sole arrival before expiry, or neither-arrived draw. Use the server-provided damage breakdown, without client scoring logic or a fabricated unfinished-route click differential.
- Preserve synchronized readiness after non-final Rounds and the full final-Round comparison before each player's independent continuation to Post-Duel.
- Update existing Post-Duel Round summaries for draws and new win reasons. Do not implement ticket 15's optional highlights.
- Preserve existing departure, disconnect, Forfeit, and Interruption behavior in every phase, including while one player has arrived.

## Implementation seams

Extend existing modules rather than replacing the Duel architecture:

- `wikiduel-contracts/src/index.ts`: strict Zod commands and player-specific projections for settings, deadline, arrival status, own arrival time, completed/unfinished outcome records, conditional damage breakdowns, and draw-capable summaries. Keep runtime shape validation separate from transition authorization. Follow ADR 0003.
- `wikiduel-server/src/duel-core/duelCore.ts`: individual arrival state, authoritative order, deadline checks and outcome creation, setting lifecycle, and private projections. Keep external article resolution outside the synchronous acceptance transition.
- `wikiduel-server/src/duel-core/damageRule.ts`: pure, labeled, versioned Damage Rule supporting the approved cases. Update the rule identifier to distinguish the replacement policy.
- Server scheduling and WebSocket integration in `wikiduel-server/src/app.ts`: schedule deadline transitions and publish authoritative projections without duplicating core rules.
- Existing Lobby/Duel screens and `PostRound`/`PostDuel` modules: render the new contracts and actions, preserving existing preparation and departure flows.

The contract review found current outcome schemas require a winner and target-arrival end reason, and current player times assume the same Round end. Replace those assumptions coherently across server, client, fixtures, and tests. No new architectural decision is required; ADR 0003 still applies.

## Acceptance criteria

- [x] Every outcome-table row produces the correct winner or draw, damage, reason, and HP exactly once.
- [x] First arrival freezes only that player and leaves the Round active; a later arrival with fewer clicks wins. Equal-click ties use authoritative order even with identical timestamps.
- [x] Host toggle authorization, off default, readiness reset, setting visibility, and persistence match the rules above.
- [x] Timing excludes preparation/countdown, and strict acceptance ordering rejects Navigation at or after expiry, including pending asynchronous resolution.
- [x] Timers and pending work cannot mutate closed Rounds, later Rounds, or Rematches. Toggle-off Rounds have no expiry.
- [x] Waiting Navigation is locked on both server and client; arrived players retain readable target content and their own frozen time.
- [x] Live messages and UI expose arrival status and clicks while preserving opponent route and exact-time privacy until Post-Round.
- [x] Two-arrival, sole-arrival, and neither-arrival reviews display correct paths, labels, times, outcome explanations, and authoritative damage breakdowns.
- [x] Final-Round review and existing Post-Duel summaries handle the new outcomes without implementing optional highlights.
- [x] Later Rounds and Rematches reset per-Round arrivals, order, paths, clocks, and readiness while retaining the Lobby timer setting and existing Prompt-history behavior. Rematch resets HP to 100.
- [x] Existing departure/disconnect Forfeit and system Interruption behavior remains intact while waiting after arrival.
- [ ] Focused tests, typecheck, full test suite, build, lint, and the manual scenarios below pass; record results before completion.

## Regression and manual validation

Use test-first work at the existing pure Damage Rule, core-transition, shared-decoder, WebSocket, and client-rendering seams. Use injected clocks and deterministic article adapters rather than waiting five real minutes in automated tests.

- Rule tests: click differences 0, 1, 11, 12, and a larger value produce 25, 28, 58, 60, and 60 damage; sole arrival produces 60; neither arrival produces 0. Cover low remaining HP.
- Core tests: first arrival waits, later fewer-click arrival wins, equal-click order is stable with equal timestamps, neither/one arrival expires correctly, and no-deadline Rounds remain active. Exercise just before, exactly at, and after the deadline, delayed timer execution, and article resolution crossing expiry.
- Scheduler and integration tests: duplicate and stale callbacks, duplicate Navigation, deadline versus second-arrival races, shutdown/disband cleanup, and exactly one outcome/HP change. Exercise two actual test WebSockets and inspect both private projections.
- Contract tests: valid variants and malformed settings, arrival records, draw outcomes, timeout damage, and Post-Duel summaries through exported decoders.
- Client tests: Host setting changes and readiness reset, guest restrictions, elapsed/remaining clocks, readable locked target, arrival status, own frozen time, private opponent details, all outcome labels, and final review.
- Complete a deterministic multi-Round zero-HP Duel containing a timeout draw and a sole-arrival win, then Rematch. Verify reset state, retained timer setting, retained Prompt history, and immunity to old callbacks. Also cover the timer-off two-arrival loop.
- In two desktop browsers, test toggle visibility/readiness reset, timer off with the first player waiting, a later fewer-click win, equal-click tie, timer on with one/no arrivals, next-Round readiness, final-Round review, Post-Duel, Rematch, Back to Lobby, and departure/disconnect while one player waits. Verify opponent routes/times appear only after the Round ends. Exercise the deployed five-minute duration at least once.

Run the smallest relevant test file and `npm run typecheck` during implementation. Once stable, run `npm test`, `npm run build`, and `npm run lint` once. Record browser evidence and any unavailable validation honestly; do not mark this ticket complete with required checks outstanding.

## Dependencies

- Planning approval in [duel-lifecycle/17](./17-refine-click-scored-rounds.md).
- Existing shared contracts and completed Duel lifecycle tickets 01 through 10 are the implementation baseline.
- [deployment/01](../../deployment/tickets/01-deploy-the-first-test-build.md) precedes this work in the MVP delivery order. Deployment can finish against the previous gameplay; it does not depend on ticket 18. Deterministic tests use existing fixtures, while live manual validation requires the production Prompt seed and running application.

## Out of scope

- Speed scoring, custom timer durations, selectable Damage Rules, or scoring from unfinished routes.
- Reconnect/recovery, optional opponent-activity polish, optional Post-Duel highlights, analytics, and animated path review.
- Changing the existing preparation, Prompt selection, departure, or Forfeit policies.

## Comments

- 2026-10-02: Maintainer approved the complete rules and a single implementation ticket. Planning and implementation share the existing branch; this ticket remains open until gameplay changes and validation are complete.

- 2026-10-02: Implemented on the requested current branch `codex/17-refine-click-scored-rounds`, starting at `49f975b`. The core freezes individual arrivals, resolves click scores and expiry once, and rejects late asynchronous Navigation. Strict contracts distinguish completed routes, sole arrivals, and draws. Lobby settings, waiting screens, Round reviews, and Post-Duel summaries use the server projections.
- 2026-10-02: Automated validation passed: `npm test` with 335 passed and one existing opt-in live-Wikipedia test skipped; `npm run typecheck`; `npm run build`; `npm run lint`. Lint retains one existing `HomePage.tsx` warning. After review, renamed the side-effecting eligibility check and reran typecheck, all 49 core tests, the full suite, build, and lint successfully. Standards review has no remaining findings; Spec review has no code findings and records the known deployment validation gap.
- 2026-10-02: Local browser checks use two independent player tabs in the Codex desktop browser against the built app at `http://127.0.0.1:4318`, with deterministic articles and the real server clock. Verified default-off and guest-disabled toggle, shared setting visibility, readiness reset, first-arrival waiting with readable locked content and frozen own time, private opponent details, later fewer-click win, equal-click earlier-arrival win, synchronized next-Round readiness, capped damage, zero-HP final review, independent Post-Duel continuation, Back to Lobby, Rematch with HP reset and the enabled Time Limit retained, new-Lobby reset to off, and confirmed departure and disconnect while one player waits. No browser console warnings or errors were observed. A real five-minute no-arrival Round produced a draw with both elapsed times exactly 300 seconds and no HP loss. Evidence: [fewer-click review](../validation/18-fewer-clicks.jpg), [five-minute draw](../validation/18-five-minute-draw.jpg), and [sole-arrival expiry](../validation/18-sole-arrival.jpg). A second real five-minute Round awarded 60 damage for the sole arrival, preserving the winner's 13.090-second arrival and freezing the unfinished route at 300.000 seconds.
- 2026-10-02: Ticket remains `ready-for-agent`. The required deployed five-minute run and two-desktop-browser acceptance with the production Prompt seed remain outstanding. Deployment/01 still awaits Dokploy setup and a supplied HTTPS URL. Local fixture checks do not satisfy those requirements, so the final validation criterion remains unchecked.
