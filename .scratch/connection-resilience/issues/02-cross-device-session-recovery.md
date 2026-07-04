# Recover a Player Session on Another Device

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Let a player securely reclaim an eligible Player Session from another browser or device without admitting a replacement player into the Lobby.

## Acceptance criteria

- [ ] Recovery requires an explicit secure credential or handoff flow.
- [ ] A recovered Player Session keeps the same identity and Lobby seat.
- [ ] The prior connection can no longer issue authoritative commands.

## Blocked by

- [`connection-resilience/01`](./01-short-reconnect-window.md)

## Out of scope

- User accounts
- Persistent friends or profiles
- Backend-restart recovery

## Comments

- 2026-07-03: Deferred until after the MVP is finished and tested.
