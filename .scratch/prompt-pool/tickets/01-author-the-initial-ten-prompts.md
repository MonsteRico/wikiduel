# Author the Initial Ten Prompts

Status: completed
Scope: MVP required
Category: content
Completed: 2026-10-01 05:39 PM

## What to build

After the Prompt Catalog format exists, the maintainer authors and maintains the ten enabled ordered Prompts used for manual Duel play and the first deployed test. Agents may provide format guidance and validation output but must not invent, replace, route-verify, balance, or assign difficulty to the production Prompt set in this ticket.

## Acceptance criteria

- [x] The maintainer has authored exactly ten enabled Prompt records in the version-controlled production seed.
- [x] Every record conforms to the implemented Prompt format and passes structural and endpoint validation.
- [x] No ordered pair is duplicated and no canonical start collapses to its target.
- [x] The application can load the seed and make all ten Prompts available to a Lobby.
- [x] Prompt authorship and later maintenance remain an explicit human responsibility.

## Blocked by

- [`duel-lifecycle/01`](../../duel-lifecycle/tickets/01-establish-the-prompt-catalog.md)

## Out of scope

- Route verification or guaranteed reachability
- Difficulty assignment, balance, variety, or shortcut analysis
- Agent-authored or automatically generated production Prompts
- Expanding beyond ten Prompts

## Comments

- 2026-07-12: Human Prompt authorship blocks manual play and deployment, not Duel implementation against deterministic test fixtures.
- 2026-10-01: The maintainer supplied all ten ordered pairs and clarified the Yemen target. Saved canonical titles in `wikiduel-server/prompts/production.json`; Wikipedia redirects resolve Cow to Cattle, Conga dance to Conga line, and Neurosurgeon to Neurosurgery. The chicken company is Perdue Farms. No routes or difficulty were evaluated.
- 2026-10-01: Server startup now validates and loads the production seed. Sequential endpoint loading avoids the request burst that caused live rate limits. Live validation passed for all ten enabled Prompts; a production application smoke check passed, and Lobby selection exhausted all ten before repeating. `npm test` passed with 208 tests and 5 opt-in tests skipped; typecheck, build, and lint passed. Dependency installation required `npm ci --legacy-peer-deps` due to existing missing peer entries in the lockfile, which was left unchanged.
