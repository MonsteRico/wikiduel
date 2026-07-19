# Add the Fixed Time Limit

Status: ready-for-agent
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Add one server-authoritative fixed five-minute Time Limit to each active Round through the existing Round Outcome seam. When enabled in the deployed build, replace the elapsed stopwatch with remaining time and create a no-damage draw if no Target Arrival is accepted before expiry.

## Acceptance criteria

- [ ] Every active Round receives exactly one deadline five minutes after its authoritative start; preparation and the three-second countdown are excluded.
- [ ] Both clients derive remaining time from the same authoritative start/deadline and no longer show the elapsed stopwatch while the Time Limit is enabled.
- [ ] A Target Arrival accepted before expiry wins; later Navigation is rejected.
- [ ] Expiry invokes the existing Round Outcome seam, freezes both partial paths and clicks, records active times, deals zero damage, and preserves HP.
- [ ] Post-Round clearly distinguishes a Time Limit draw from a win.
- [ ] Injected-clock tests cover exact-boundary ordering, duplicate scheduling, stale callbacks, and timer cleanup.

## Blocked by

- [`duel-lifecycle/07`](./07-reveal-post-round-and-continue.md)

## Out of scope

- Required-MVP delivery
- Configurable, disabled, or per-player Time Limits
- Selecting a winner from partial progress
- Disconnect pause accounting

## Comments

- 2026-07-12: Moved from MVP required to MVP optional. Required play shows an elapsed stopwatch and has no active-Round deadline.
