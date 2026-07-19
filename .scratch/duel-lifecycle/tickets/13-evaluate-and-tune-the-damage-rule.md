# Evaluate and Tune the Damage Rule

Status: needs-info
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Use first-test observations and Round Outcomes to decide whether the locked Damage Rule's base, click differential, or clamps should change before a larger-group test.

## Acceptance criteria

- [ ] The decision cites observed Duel length and damage-distribution evidence.
- [ ] Any replacement remains server-authoritative and explainable Post-Round.
- [ ] A changed rule has an explicit version and boundary tests.
- [ ] If evidence does not justify change, the existing rule and rationale are retained explicitly.

## Blocked by

- [`duel-lifecycle/09`](./09-rematch-or-return-to-the-lobby.md)
- Completed first small-group testing.

## Out of scope

- Shortest-path, time, category, difficulty, or estimated-distance scoring
- Per-Lobby or selectable Damage Rules

## Comments

- 2026-07-12: Waiting for playtest evidence; the locked formula must not be pre-optimized.
