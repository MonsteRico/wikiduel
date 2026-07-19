# Enter the First Duel

Status: ready-for-agent
Scope: MVP required
Category: enhancement

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Replace the notification-only Lobby start with the first vertical authoritative Duel slice. A ready Host starts one Duel, the server creates two 100-HP player states, obtains a Prompt from the Prompt Catalog, initializes Round-one paths and clicks, enters covered preparation, and projects the correct state to both clients through shared contracts. Establish the minimum transport-independent core and make disconnect during any Duel phase terminate and disband exactly once.

## Acceptance criteria

- [ ] Only the Host of a full Lobby whose two players are ready can create a Duel.
- [ ] A repeated or concurrent start command cannot create competing Duels or first Rounds.
- [ ] Both players begin the Duel at 100 HP and Round one at the Prompt start with zero clicks.
- [ ] The selected Prompt is reserved in the Lobby's used-Prompt history.
- [ ] Both clients leave the Lobby screen for a covered preparing-Duel screen without receiving opponent-private route state.
- [ ] Duel transitions are exercised through a transport-independent core interface rather than being embedded in WebSocket branching.
- [ ] Commands invalid for the current Lobby or Duel state return a stable rejection and do not mutate state.
- [ ] Disconnect during preparation or any later Duel state terminates by Forfeit, disbands the Lobby, and notifies the connected player exactly once.
- [ ] New command and projection payloads extend the shared Zod contracts and are decoded before reaching the core.

## Blocked by

- [`shared-contracts/01`](../../shared-contracts/tickets/01-establish-shared-client-server-contracts.md)
- [`duel-lifecycle/01`](./01-establish-the-prompt-catalog.md)

## Out of scope

- Preparation acknowledgements or countdown
- Navigation, Damage Rule application, Post-Round, or Rematch
- Explicit leave confirmation and browser-navigation UX
- Reconnection or replacement players

## Comments

- 2026-07-12: This is an incremental core-first tracer bullet, not an upfront implementation of the complete state machine.
