# Refine click-scored rounds where both players finish

Status: completed
Scope: MVP required
Category: planning
Completed: 2026-10-02 04:50 PM on `codex/17-refine-click-scored-rounds`

## Priority and outcome

This is the next required MVP work after [deployment/01](../../deployment/tickets/01-deploy-the-first-test-build.md). The first small-group MVP now includes this gameplay change. Deployment can finish against the current gameplay implementation.

Run a grilling session, settle the rules, update the affected specifications, and create implementation tickets. Do not implement unanswered rules from this planning ticket.

## Confirmed direction

- The first Target Arrival no longer ends the Round. Without a Time Limit, both players must reach the target before the Round ends.
- The Host can optionally enable a Time Limit. Its expiry ends the Round even if one or both players have not finished.
- Clicks are the only scoring mode for now. A speed-based mode is a possible future addition.
- When both players finish, fewer clicks wins. Damage depends on the click difference.
- When both finish with equal clicks, the earlier finisher wins the tie and deals damage.
- If the Time Limit expires with neither player finished, the Round is a draw.
- Timer implementation is part of this required change, replacing [duel-lifecycle/11](./11-add-the-fixed-time-limit.md).

## Grilling decisions, 2026-10-02

This chat completes planning and creates linked implementation tickets. The same branch, `codex/17-refine-click-scored-rounds`, will carry the later gameplay implementation. The branch starts from `master` in the main working directory; this repository has no `main` branch.

Confirmed by the maintainer in round one:

- When both players arrive, fewer clicks wins. Damage is `min(60, 25 + 3 * (loser clicks - winner clicks))`. Equal clicks award the earlier server-accepted Target Arrival the win and 25 damage.
- If exactly one player arrives before Time Limit expiry, that player wins and deals maximum damage, 60, regardless of unfinished clicks. Neither arrival means a draw and zero damage.
- The Host gets a fixed five-minute on/off toggle, default off. Changes are allowed only in the Lobby, clear both players' readiness, and persist through Rematches. Active timing starts after preparation and countdown.
- Target Arrival locks that player's Navigation and freezes their clicks and arrival time. They may read the target article while waiting. Both players see arrival status and existing live opponent click counts; opponent articles and routes remain private until Post-Round.
- Navigation must finish server validation and be accepted strictly before the deadline. Expiry wins at the exact deadline. Equal-click ties use server acceptance order, including arrivals with identical timestamps.
- Existing departure, disconnect, Forfeit, and Interruption rules remain unchanged while a player waits after Target Arrival.

Confirmed by the maintainer in round two:

- While waiting, a player sees their own frozen arrival time. The opponent's exact arrival time remains private until Post-Round.
- Post-Round shows both frozen paths and click counts, labels each as "Target reached" or "Did not reach target," and shows individual arrival times. Unfinished routes show elapsed time at expiry without claiming an arrival.
- Outcome explanations distinguish fewer clicks, earlier arrival on equal clicks, sole arrival before expiry, and neither-arrived draws. Final-Round review retains the same comparison.
- Update the existing Post-Duel summary for draws and the new win reasons. Best-path and fastest-arrival highlights remain optional under ticket 15. Its future calculations must consider either player's completed routes, including routes from lost Rounds.

The maintainer confirmed the consolidated rules and single-ticket breakdown. [Implementation ticket 18](./18-implement-click-scored-rounds.md) contains dependencies, acceptance criteria, and regression/manual validation for the complete gameplay change. Planning completion does not mean those gameplay changes have shipped.

## Original questions for grilling, now resolved

- If exactly one player finishes before expiry, does that player always win? How is damage calculated against an unfinished route?
- What is the exact damage formula for two completed routes, including base, per-click increment, minimum, maximum, and equal-click damage? Do not assume the current formula carries over.
- Is a neither-finished draw always zero damage, and how should unfinished paths appear?
- Is the timer duration fixed or Host-selected? What is its default, when can settings change, and do they persist through Rematch?
- What can a finished player see and do while waiting? Decide navigation lock, waiting UI, and opponent route privacy.
- What does the unfinished player learn when the opponent finishes?
- How should server-authoritative arrival order break ties? Define exact deadline ordering and any indistinguishable arrival case.
- Do existing departure, disconnect, Forfeit, and Interruption rules remain unchanged while one player has finished?
- How should Post-Round, final-Round review, and Post-Duel highlights represent two arrivals, one arrival, and no arrivals?

## Planning acceptance criteria

- [x] The maintainer confirms a complete outcome and damage decision table.
- [x] Timer settings, persistence, expiry ordering, waiting behavior, and information privacy are explicit.
- [x] Update MVP and Duel Lifecycle specs and review domain terminology and shared contracts for required changes.
- [x] Reconcile tickets 11, 13, 15, and 16 with the new rules so conflicting implementation instructions do not remain active.
- [x] Create linked implementation tickets with dependencies, acceptance criteria, and regression/manual validation covering later Rounds and Rematches. Include the timer work.

## Out of scope

- Implementing speed scoring
- Reconnect/session recovery unless separately approved
- Animated graph review, tracked in [wayfinder/01](../../wayfinder/tickets/01-explore-animated-round-path-review.md)

## Comments

- 2026-10-02: Maintainer made this an MVP requirement and the next gameplay task after deployment setup. Completed tickets remain historical records of the previous first-arrival-wins implementation. Specifications will be reconciled during grilling before implementation.
- 2026-10-02: Planning complete after maintainer confirmation. Updated both specs, glossary, backlogs, and tickets 11, 13, 15, and 16; created implementation ticket 18. Standards and Spec reviews found no issues. Local Markdown links resolve and `git diff --check` passes. No runtime code changed, so application tests/build/lint were not run for this planning change. Ticket 18 owns those checks and the pending gameplay implementation.
