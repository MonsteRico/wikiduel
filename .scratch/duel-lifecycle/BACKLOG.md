# Duel Lifecycle Backlog

Status: ready-for-agent
Source: [Duel Lifecycle spec](./spec.md)

This is the canonical progress and dependency index for direct Duel behavior. After deployment setup, the next required work is grilling [duel-lifecycle/17](./tickets/17-refine-click-scored-rounds.md), then implementing its agreed rules. Earlier completed tickets record the original gameplay model.

## External prerequisites and checkpoints

- [`shared-contracts/01`](../shared-contracts/tickets/01-establish-shared-client-server-contracts.md) — next task; establish the Zod-validated realtime seam
- [`prompt-pool/01`](../prompt-pool/tickets/01-author-the-initial-ten-prompts.md) — ready-for-human production Prompt seed; blocks manual play and deployment only
- The required Playable Article foundation and Lobby transport baseline are already completed.

## MVP required

Next: [`duel-lifecycle/17`](./tickets/17-refine-click-scored-rounds.md), refine both-player completion, click-based damage, and a Host-toggleable Time Limit before creating implementation tickets.

1. [`duel-lifecycle/01`](./tickets/01-establish-the-prompt-catalog.md) — establish the Prompt format, validation, selection, fixtures, and Lobby history
2. [`duel-lifecycle/02`](./tickets/02-enter-the-first-duel.md) — cross the Lobby seam into the minimal authoritative Duel core
3. [`duel-lifecycle/03`](./tickets/03-prepare-and-start-every-round.md) — reuse fair covered preparation, acknowledgement, countdown, and stopwatch behavior
4. [`duel-lifecycle/04`](./tickets/04-apply-the-damage-rule.md) — isolate and verify the locked Damage Rule
5. [`duel-lifecycle/05`](./tickets/05-create-authoritative-round-outcomes.md) — freeze a Round and apply damage through one authoritative transition
6. [`duel-lifecycle/06`](./tickets/06-navigate-and-show-the-active-round.md) — navigate, reach the target, show the HUD, and protect opponent information
7. [`duel-lifecycle/07`](./tickets/07-reveal-post-round-and-continue.md) — compare routes and loop through later Rounds
8. [`duel-lifecycle/08`](./tickets/08-complete-the-duel-and-show-post-duel.md) — preserve the final comparison and show normal completion
9. [`duel-lifecycle/09`](./tickets/09-rematch-or-return-to-the-lobby.md) — complete the repeat-play loop
10. [`duel-lifecycle/10`](./tickets/10-confirm-leave-duel-and-forfeit.md) — complete explicit departure and terminal Forfeit UX

## MVP optional

- [`duel-lifecycle/11`](./tickets/11-add-the-fixed-time-limit.md) is superseded by required ticket 17; do not implement separately.
- [`duel-lifecycle/12`](./tickets/12-show-opponent-activity.md) — add non-strategic Navigation activity feedback
- [`duel-lifecycle/13`](./tickets/13-evaluate-and-tune-the-damage-rule.md) — revisit damage after first-test evidence
- [`duel-lifecycle/14`](./tickets/14-show-a-forfeit-summary.md) — enrich terminal Forfeit explanation
- [`duel-lifecycle/15`](./tickets/15-enrich-the-post-duel-summary.md) — add best-path and fastest-arrival highlights

## Future

- [`duel-lifecycle/16`](./tickets/16-add-configurable-time-limits.md) — make an implemented Time Limit configurable if evidence warrants it
