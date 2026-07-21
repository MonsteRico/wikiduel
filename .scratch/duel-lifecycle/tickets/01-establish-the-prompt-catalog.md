# Establish the Prompt Catalog

Status: completed
Scope: MVP required
Category: enhancement
Completed: 2026-07-20 08:16 PM

## Parent

- [Duel Lifecycle spec](../spec.md)

## What to build

Provide the server-side Prompt Catalog needed to run Duels without coupling implementation to production Prompt authorship. Define the version-controlled ordered start/target format, load and structurally validate it, expose deterministic test fixtures, select enabled Prompts, and retain used-Prompt history for each Lobby until the enabled catalog is exhausted and reshuffled.

## Acceptance criteria

- [x] The Prompt format includes stable ID, canonical start and target identity, enabled state, and optional maintainer metadata without requiring route, par, or difficulty data.
- [x] Loading rejects malformed records, duplicate IDs, duplicate ordered pairs, identical or canonically collapsed endpoints, and an unusable enabled catalog with clear diagnostics.
- [x] Endpoint validation uses the Playable Article interface without leaking Wikipedia adapter details into the Prompt Catalog.
- [x] Tests and later Duel work can inject deterministic Prompts without loading the production seed.
- [x] Selection returns one enabled Prompt unused by the Lobby when one exists.
- [x] A Lobby retains used-Prompt history across Rounds and Rematch Duels, exhausts the enabled catalog before repeating, then reshuffles.
- [x] A new Lobby begins with the full enabled catalog available.
- [x] The maintainer-facing seed format and validation command are documented sufficiently to complete `prompt-pool/01`.

## Blocked by

- None — can proceed independently, though `shared-contracts/01` remains the recommended next repository task.

## Out of scope

- Authoring the production ten-Prompt seed
- Route verification, difficulty, balance, or quality scoring
- Prompt generation or automatic production enablement
- Persistent Prompt or Lobby history storage

## Comments

- 2026-07-12: The production seed is a separate ready-for-human checkpoint; this ticket uses deterministic fixtures.
- 2026-07-20: Implemented the versioned loader, Playable Article endpoint validation, deterministic fixtures, Lobby-scoped selector, validation command, and maintainer guide. Full tests, build, lint, and two-axis review passed.
