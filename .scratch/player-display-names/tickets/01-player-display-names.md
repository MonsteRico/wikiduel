# Add Player Display Names

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Let each anonymous Player Session choose a short display name that appears consistently in the Lobby, Duel HUD, route comparison, and post-Duel summary.

## Acceptance criteria

- [ ] Names have clear length and character rules.
- [ ] Empty or rejected names fall back to `You` and `Opponent` semantics.
- [ ] Names cannot inject markup or disrupt the layout.
- [ ] Adding names does not create accounts, profiles, or persistent identity.

## Blocked by

- The required Player Session and Lobby flow.

## Out of scope

- Accounts or authentication
- Avatars, profiles, friends, or persistent identity

## Comments

- 2026-07-03: Classified as MVP optional for a larger-group test.
