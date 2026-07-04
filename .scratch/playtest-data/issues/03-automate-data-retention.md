# Automate Playtest Data Retention

Status: needs-triage
Scope: Future
Category: enhancement

## What to build

Apply explicit retention periods to persisted gameplay events and free-text feedback while preserving permitted aggregate metrics.

## Acceptance criteria

- [ ] Expired raw events and feedback are deleted automatically.
- [ ] Retention jobs are observable and safe to retry.
- [ ] Aggregate data cannot be used to recover deleted player-level records.

## Blocked by

- Durable playtest persistence and a finalized privacy policy.

## Comments

- 2026-07-03: Deferred until after MVP testing as released-product data governance.
