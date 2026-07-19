# Prepare and Start Every Round

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Give first, subsequent, and Rematch Rounds one reusable fair start path. Deliver the same covered start Playable Article and target to both clients, wait for successful render acknowledgements, interrupt and disband if either acknowledgement is absent after 30 seconds, then reveal titles and begin from one server-authoritative three-second countdown. At zero, enable Navigation and show an elapsed stopwatch derived from the shared start time.

## Acceptance criteria

- [ ] Both players receive the same Prompt and covered start Playable Article before the Round starts.
- [ ] Article content and Navigation remain unavailable during preparation and until the authoritative start moment.
- [ ] The countdown cannot be scheduled until both clients acknowledge successful covered rendering for the current Round.
- [ ] A stale, duplicate, or wrong-Round acknowledgement cannot advance preparation.
- [ ] A fixed 30-second acknowledgement deadline starts only after both clients receive the prepared Round.
- [ ] Deadline expiry creates an Interruption, assigns no winner, enters no normal Post-Round/Post-Duel flow, disbands the Lobby, and presents a clear notice.
- [ ] Both clients derive the three-second countdown and active start from the same server timestamp.
- [ ] Navigation submitted before the active start is rejected without changing the path or clicks.
- [ ] The active HUD replaces the start countdown with elapsed stopwatch time derived from the authoritative start.
- [ ] The same interface is reusable when Post-Round or Rematch requests another Round.
- [ ] Injected clocks and deterministic timers cover acknowledgement, deadline, countdown, and activation behavior.

## Blocked by

- [`duel-lifecycle/02`](./02-enter-the-first-duel.md)

## Out of scope

- A Round Time Limit or remaining-time countdown
- Retrying a persistently failing connected client
- Reconnection or latency compensation
- Navigation after activation

## Comments

- 2026-07-12: The preparation deadline is distinct from the three-second start countdown and any later Time Limit.
