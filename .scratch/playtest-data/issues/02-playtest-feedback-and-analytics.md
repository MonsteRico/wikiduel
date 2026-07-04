# Capture Playtest Feedback and Analytics

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Capture the minimum durable events and optional player feedback needed to evaluate rematches, Duel completion, prompt behavior, damage fairness, and player confusion during a larger-group playtest.

## Acceptance criteria

- [ ] Rematch starts and normally completed Duels can be counted reliably.
- [ ] Round outcomes include prompt, paths, clicks, elapsed time, and damage breakdown.
- [ ] Optional feedback never blocks Rematch or returning to the Lobby.
- [ ] Data collection excludes names, IP addresses, credentials, and raw article HTML.

## Blocked by

- [`playtest-data/01`](./01-persist-completed-duels.md)

## Out of scope

- Product dashboards
- Third-party analytics SDKs
- Automatic product decisions based on thresholds

## Comments

- 2026-07-03: Classified as MVP optional for a larger-group playtest. First-test learning may be gathered through observation and server logs.
