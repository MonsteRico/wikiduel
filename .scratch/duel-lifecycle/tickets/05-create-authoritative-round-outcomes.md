# Create Authoritative Round Outcomes

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Create the one authoritative transition that ends an active Round. Given a valid Target Arrival and frozen server state, produce an immutable Round Outcome containing the end reason, winner, both paths, click counts, active elapsed times, Damage Rule breakdown, resulting HP, and final/non-final status. Reject duplicate or late attempts without changing the recorded outcome.

## Acceptance criteria

- [ ] A valid first Target Arrival freezes both players' canonical paths and click counts exactly once.
- [ ] Both active elapsed times derive from the authoritative Round start and accepted end time rather than client clocks.
- [ ] The Damage Rule receives only frozen authoritative inputs and its final damage is applied to the losing player's HP.
- [ ] HP persists from prior Rounds, clamps at zero, and cannot become negative.
- [ ] The Round Outcome is immutable and includes one server-provided labeled damage breakdown and both resulting HP values.
- [ ] A zero-HP result marks the Duel normally completed while retaining the final Round Outcome for Post-Round presentation.
- [ ] A non-zero result marks the Duel ready to enter Post-Round and later prepare another Round.
- [ ] Duplicate Target Arrival, late Navigation, stale Round IDs, and repeated completion attempts cannot overwrite or reapply damage.
- [ ] Both player projections identify the same public Round Outcome while retaining only information that becomes public after Round end.
- [ ] The transition interface can accept an additional future end cause without restructuring Navigation or Post-Round.

## Blocked by

- [`duel-lifecycle/02`](./02-enter-the-first-duel.md)
- [`duel-lifecycle/04`](./04-apply-the-damage-rule.md)

## Out of scope

- Triggering Target Arrival through Navigation
- Post-Round route-comparison UI or readiness
- Time Limit draws
- Post-Duel summary or Rematch

## Comments

- 2026-07-12: Round Outcome is the authoritative record; Post-Round is the later synchronized presentation/readiness phase.
