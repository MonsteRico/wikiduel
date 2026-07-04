# Enforce the Round Time Limit

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Apply the fixed five-minute Time Limit to every active Round using the authoritative server start time. Show the remaining time to both players and end an unresolved Round as a no-damage draw when it expires.

## Acceptance criteria

- [ ] Every Round receives exactly one server-authoritative five-minute deadline.
- [ ] Both clients display time derived from the same authoritative start/deadline.
- [ ] Target Arrival accepted before expiry wins; later Navigation is rejected.
- [ ] Expiry freezes both partial paths and click counts, deals zero damage, and opens Post-Round comparison.
- [ ] Countdown time before Round start is not charged against the five minutes.

## Blocked by

- [`round-start/02`](../../round-start/issues/02-synchronize-round-preparation.md)
- [`navigation/01`](../../navigation/issues/01-navigate-and-track-the-player-path.md)

## Out of scope

- Configurable or disabled Time Limits
- Choosing a timeout winner by partial progress
- Disconnect pause accounting until the optional reconnect feature exists

## Comments

- 2026-07-03: A fixed terminal condition is required to prevent stuck first-test Duels.
