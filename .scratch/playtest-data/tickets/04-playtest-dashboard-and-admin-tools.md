# Add Playtest Dashboard and Admin Tools

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Give authorized maintainers a focused way to inspect aggregate playtest health, prompt performance, interruptions, and damage distribution without direct database access.

## Acceptance criteria

- [ ] Administrative data is access-controlled.
- [ ] Aggregate views expose enough context to identify unhealthy prompts and Duel failures.
- [ ] Administrative actions cannot mutate active Duel state accidentally.

## Blocked by

- Stable persisted analytics and an authorization model.

## Out of scope

- Player-facing profiles or match history
- Public leaderboards

## Comments

- 2026-07-03: Deferred until after MVP testing as released-product tooling.
