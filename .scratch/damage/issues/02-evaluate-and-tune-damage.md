# Evaluate and Tune Damage

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Use first-test observations and Round outcomes to decide whether the locked Damage Rule's base, click differential, or clamps should change before a larger-group test.

## Acceptance criteria

- [ ] The decision cites observed Duel length and damage-distribution evidence.
- [ ] Any replacement remains server-authoritative and explainable Post-Round.
- [ ] A changed rule has an explicit version and boundary tests.

## Blocked by

- [`damage/01`](./01-apply-hp-and-damage.md)
- Completed first small-group testing.

## Out of scope

- Shortest-path graph or estimated-distance scoring
- Per-Lobby rule selection

## Comments

- 2026-07-03: The current formula must not be pre-optimized before it is played.
