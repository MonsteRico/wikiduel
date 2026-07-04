# Synchronize Round Preparation

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Prepare the same start Playable Article on both clients, keep it covered and non-navigable, wait for both clients to acknowledge that it rendered, then begin the Round from one server-authoritative three-second countdown.

## Acceptance criteria

- [ ] Both players receive the same start and target before the Round starts.
- [ ] Article content and Navigation remain unavailable during preparation.
- [ ] The countdown cannot start until both clients acknowledge successful rendering.
- [ ] Both clients derive the start moment from the same server-authoritative value.
- [ ] Navigation submitted before the start moment is rejected without consuming a click.
- [ ] A disconnect during preparation produces the required-MVP Forfeit behavior.

## Blocked by

- [`playable-articles/01`](../../playable-articles/issues/01-fetch-and-sanitize-playable-articles.md)
- [`round-start/01`](./01-enter-the-first-round.md)

## Out of scope

- Retrying a persistently slow but connected client
- Reconnection during preparation
- Latency compensation beyond the shared server start time

## Comments

- 2026-07-03: Synchronized preparation is required for a credible first-test race. Sophisticated recovery remains optional.
