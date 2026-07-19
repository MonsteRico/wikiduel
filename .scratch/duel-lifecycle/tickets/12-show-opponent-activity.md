# Show Opponent Activity

Status: ready-for-agent
Scope: MVP optional
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Show a subtle, accessible signal when the opponent completes a Navigation without revealing the destination, current article, route, or estimated distance.

## Acceptance criteria

- [ ] The signal communicates activity using only an already-authorized Navigation occurrence.
- [ ] No new projection reveals opponent-private article, path, destination, or distance data.
- [ ] The signal remains nonessential, understandable without color, and respects reduced-motion preferences.
- [ ] Repeated Navigation cannot create distracting or indefinitely queued animation.

## Blocked by

- [`duel-lifecycle/06`](./06-navigate-and-show-the-active-round.md)

## Out of scope

- Opponent route disclosure
- Spectator activity feeds

## Comments

- 2026-07-12: Deferred tension polish; required opponent status is part of `duel-lifecycle/06`.
