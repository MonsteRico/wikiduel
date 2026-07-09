# Preserve Lobbies Across Extended Absence

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Allow the same paired players to return to a Lobby after a substantially longer absence than the brief reconnect window, with an explicit expiry policy and no replacement-player ambiguity.

## Acceptance criteria

- [ ] Lobby lifetime and expiry rules are explicit and observable.
- [ ] Returning players reclaim their original Host or opponent role.
- [ ] Expired Lobbies cannot be revived accidentally.

## Blocked by

- A durable Player Session recovery design.

## Out of scope

- Public matchmaking
- Friends lists
- Indefinitely permanent Lobbies

## Comments

- 2026-07-03: Deferred until after the MVP is finished and tested.
