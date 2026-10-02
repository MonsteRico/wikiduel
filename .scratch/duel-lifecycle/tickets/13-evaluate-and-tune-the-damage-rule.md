# Evaluate and Tune the Damage Rule

Status: needs-info
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Use first-test observations and Round Outcomes from [duel-lifecycle/18](./18-implement-click-scored-rounds.md) to decide whether the agreed Damage Rule should change before a larger-group test. Its starting policy is `min(60, 25 + 3 * click difference)` for two arrivals, 25 for equal clicks, 60 for a sole arrival at expiry, and zero for neither arrival. This ticket does not block the approved replacement of first-arrival scoring.

## Acceptance criteria

- [ ] The decision cites observed Duel length and damage-distribution evidence.
- [ ] Any replacement remains server-authoritative and explainable Post-Round.
- [ ] A changed rule has an explicit version and boundary tests.
- [ ] If evidence does not justify change, the existing rule and rationale are retained explicitly.

## Blocked by

- [`duel-lifecycle/09`](./09-rematch-or-return-to-the-lobby.md)
- Completed first small-group testing.
- [`duel-lifecycle/18`](./18-implement-click-scored-rounds.md)

## Out of scope

- Shortest-path, time, category, difficulty, or estimated-distance scoring
- Per-Lobby or selectable Damage Rules

## Comments

- 2026-07-12: Waiting for playtest evidence; the locked formula must not be pre-optimized.
- 2026-10-02: The earlier lock is historical. Ticket 17 approves replacement rules; this ticket remains evidence-led tuning after ticket 18 and playtesting.
