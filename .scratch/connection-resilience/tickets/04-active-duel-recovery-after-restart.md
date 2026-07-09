# Recover an Active Duel After a Backend Restart

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Persist enough authoritative live state to reconstruct an interrupted Duel after a backend process restart and reconnect both players to a consistent outcome.

## Acceptance criteria

- [ ] A supported restart cannot produce two competing authoritative Duel states.
- [ ] Recovered HP, Round, paths, timers, and readiness are mutually consistent.
- [ ] Unrecoverable interruptions produce a clear terminal outcome.

## Blocked by

- Durable active-state persistence and Player Session recovery designs.

## Out of scope

- Multiple active backend instances
- Seamless zero-downtime failover
- Disaster recovery across hosting regions

## Comments

- 2026-07-03: Deferred until after the MVP is finished and tested.
