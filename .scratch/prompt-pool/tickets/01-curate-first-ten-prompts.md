# Curate the First Ten Prompts

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Create a version-controlled seed set of ten ordered start/target prompts for the first small-group test. Each prompt should use recognizable Playable Articles, allow multiple plausible routes, and avoid obvious low-quality shortcuts.

## Acceptance criteria

- [ ] Exactly ten enabled prompts are available to the required MVP.
- [ ] Every endpoint resolves to its intended canonical Playable Article.
- [ ] Each prompt has been manually completed through valid Navigation.
- [ ] The set spans several subject areas and rough difficulty levels.
- [ ] No ordered pair is duplicated and no start collapses to its target.
- [ ] A Lobby does not repeat a prompt until all ten have been used.

## Blocked by

- [`playable-articles/01`](../../playable-articles/tickets/01-fetch-and-sanitize-playable-articles.md)

## Out of scope

- Verified shortest paths or par scores
- Automatic prompt generation
- A public prompt-management UI
- More than ten enabled prompts

## Comments

- 2026-07-03: Ten high-quality prompts are sufficient for the first small-group test.
