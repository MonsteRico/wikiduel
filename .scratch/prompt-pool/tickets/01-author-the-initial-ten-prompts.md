# Author the Initial Ten Prompts

Status: ready-for-human
Scope: MVP required
Category: content

## What to build

After the Prompt Catalog format exists, the maintainer authors and maintains the ten enabled ordered Prompts used for manual Duel play and the first deployed test. Agents may provide format guidance and validation output but must not invent, replace, route-verify, balance, or assign difficulty to the production Prompt set in this ticket.

## Acceptance criteria

- [ ] The maintainer has authored exactly ten enabled Prompt records in the version-controlled production seed.
- [ ] Every record conforms to the implemented Prompt format and passes structural and endpoint validation.
- [ ] No ordered pair is duplicated and no canonical start collapses to its target.
- [ ] The application can load the seed and make all ten Prompts available to a Lobby.
- [ ] Prompt authorship and later maintenance remain an explicit human responsibility.

## Blocked by

- [`duel-lifecycle/01`](../../duel-lifecycle/tickets/01-establish-the-prompt-catalog.md)

## Out of scope

- Route verification or guaranteed reachability
- Difficulty assignment, balance, variety, or shortcut analysis
- Agent-authored or automatically generated production Prompts
- Expanding beyond ten Prompts

## Comments

- 2026-07-12: Human Prompt authorship blocks manual play and deployment, not Duel implementation against deterministic test fixtures.
