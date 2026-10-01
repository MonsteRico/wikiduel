# Apply the Damage Rule

Status: completed
Completed: 2026-10-01 05:28 PM
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Provide one pure Damage Rule module that turns frozen winner and loser click counts into the locked MVP damage and a labeled, client-displayable breakdown. Keep calculation independently testable and free of HP initialization, transport, presentation, and Duel-completion responsibilities.

```text
damage = clamp(25 + 3 * (loser_clicks - winner_clicks), 15, 60)
```

## Acceptance criteria

- [x] The rule returns base damage, click differential, multiplier contribution, unclamped damage, clamp bounds, and final damage in a stable labeled breakdown.
- [x] Equal click counts produce 25 damage.
- [x] Positive and negative click differentials are calculated exactly from frozen authoritative inputs.
- [x] Final damage never falls below 15 or exceeds 60.
- [x] Boundary tests cover both clamps, values immediately inside each clamp, equal clicks, and large differentials.
- [x] The module has no dependency on WebSockets, React, Lobby state, timers, or Wikipedia access.
- [x] Callers cannot supply client-calculated damage in place of authoritative inputs.

## Blocked by

- None — can be implemented and verified independently.

## Out of scope

- Initializing or mutating HP
- Timeout draw behavior
- Rendering the breakdown
- Tuning the locked rule

## Comments

- 2026-07-12: Split from the former broad damage ticket so the formula remains a small, high-leverage interface.
- 2026-10-01: Added the pure server-side Damage Rule with a frozen labeled breakdown and 14 focused tests. Standards and spec reviews found no issues. Full validation passed: npm test, npm run typecheck, npm run build, and npm run lint. The suite passed 221 tests and skipped five live checks; lint retained one existing HomePage warning.
