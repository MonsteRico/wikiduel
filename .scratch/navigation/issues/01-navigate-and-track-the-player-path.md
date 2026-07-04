# Navigate and Track the Player Path

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Let a player move only through playable links on their authoritative current Playable Article. Record each accepted Navigation in order and show the player's own current path and click count during the Round as display-only information.

There is no Wikipedia backtracking. Old path entries and browser history are not article Navigation controls.

## Acceptance criteria

- [ ] The server accepts a destination only when it is a playable link from the player's authoritative current article.
- [ ] Each accepted Navigation adds exactly one canonical destination and one click.
- [ ] Invalid, failed, stale, or duplicate requests do not change path or click count.
- [ ] Only one Navigation may resolve for a player at a time.
- [ ] The player sees their ordered path and click count during the Round.
- [ ] Clicking an old path entry cannot navigate.
- [ ] Browser Back cannot restore a prior Playable Article within the active Round.
- [ ] Reaching the canonical target produces Target Arrival immediately.

## Blocked by

- [`playable-articles/01`](../../playable-articles/issues/01-fetch-and-sanitize-playable-articles.md)
- [`round-start/01`](../../round-start/issues/01-enter-the-first-round.md)

## Out of scope

- Undo, backtracking, bookmarks, or arbitrary article search
- Client-authoritative optimistic path mutation

## Comments

- 2026-07-03: A player's live route is required but strictly display-only.
