# Prepare and Start Every Round

Status: completed
Completed: 2026-10-01 05:36 PM via [PR #18](https://github.com/MonsteRico/wikiduel/pull/18)
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Give first, subsequent, and Rematch Rounds one reusable fair start path. Deliver the same covered start Playable Article and target to both clients, wait for successful render acknowledgements, interrupt and disband if either acknowledgement is absent after 30 seconds, then reveal titles and begin from one server-authoritative three-second countdown. At zero, enable Navigation and show an elapsed stopwatch derived from the shared start time.

## Acceptance criteria

- [x] Both players receive the same Prompt and covered start Playable Article before the Round starts.
- [x] Article content and Navigation remain unavailable during preparation and until the authoritative start moment.
- [x] The countdown cannot be scheduled until both clients acknowledge successful covered rendering for the current Round.
- [x] A stale, duplicate, or wrong-Round acknowledgement cannot advance preparation.
- [x] A fixed 30-second acknowledgement deadline starts only after both clients receive the prepared Round.
- [x] Deadline expiry creates an Interruption, assigns no winner, enters no normal Post-Round/Post-Duel flow, disbands the Lobby, and presents a clear notice.
- [x] Both clients derive the three-second countdown and active start from the same server timestamp.
- [x] Navigation submitted before the active start is rejected without changing the path or clicks.
- [x] The active HUD replaces the start countdown with elapsed stopwatch time derived from the authoritative start.
- [x] The same interface is reusable when Post-Round or Rematch requests another Round.
- [x] Injected clocks and deterministic timers cover acknowledgement, deadline, countdown, and activation behavior.

## Blocked by

- [`duel-lifecycle/02`](./02-enter-the-first-duel.md)

## Out of scope

- A Round Time Limit or remaining-time countdown
- Retrying a persistently failing connected client
- Reconnection or latency compensation
- Navigation after activation

## Comments

- 2026-07-12: The preparation deadline is distinct from the three-second start countdown and any later Time Limit.

- 2026-10-01: Implemented shared article preparation, receipt and covered-render acknowledgements, the fixed deadline and Interruption, a server-timed countdown, and the elapsed stopwatch. The preparation interface is reusable by later lifecycle transitions. Validated with 224 passing tests, typecheck, lint, build, and separate standards and spec reviews with no findings.
