# Refine click-scored rounds where both players finish

Status: needs-triage
Scope: MVP required
Category: planning

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

## Questions for grilling

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

- [ ] The maintainer confirms a complete outcome and damage decision table.
- [ ] Timer settings, persistence, expiry ordering, waiting behavior, and information privacy are explicit.
- [ ] Update MVP and Duel Lifecycle specs and review domain terminology and shared contracts for required changes.
- [ ] Reconcile tickets 11, 13, 15, and 16 with the new rules so conflicting implementation instructions do not remain active.
- [ ] Create linked implementation tickets with dependencies, acceptance criteria, and regression/manual validation covering later Rounds and Rematches. Include the timer work.

## Out of scope

- Implementing speed scoring
- Reconnect/session recovery unless separately approved
- Animated graph review, tracked in [wayfinder/01](../../wayfinder/tickets/01-explore-animated-round-path-review.md)

## Comments

- 2026-10-02: Maintainer made this an MVP requirement and the next gameplay task after deployment setup. Completed tickets remain historical records of the previous first-arrival-wins implementation. Specifications will be reconciled during grilling before implementation.
