# Prompt Catalog

The server-side Prompt Catalog loads a version-controlled JSON seed, resolves
every endpoint through the Playable Article repository, and exposes canonical
ordered Prompts for Duels. Production Prompt authorship remains a maintainer
task; deterministic server tests use `deterministicPromptCatalog` from
`wikiduel-server/src/prompt-catalog/fixtures.ts` instead of loading that seed.

## Seed location and format

The production seed created by `prompt-pool/01` should live at
`wikiduel-server/prompts/production.json`. The file is a versioned document:

```json
{
  "version": 1,
  "prompts": [
    {
      "id": "replace-with-a-stable-unique-slug",
      "start": "START_ARTICLE_TITLE",
      "target": "TARGET_ARTICLE_TITLE",
      "enabled": true,
      "metadata": {
        "notes": "Optional maintainer context",
        "category": "Optional maintainer grouping"
      }
    }
  ]
}
```

The example titles are placeholders, not production Prompt recommendations.

- `id` is a non-empty, case-sensitive stable identifier. Do not change it when
  correcting an endpoint title or editing metadata.
- `start` and `target` are requested Wikipedia article titles. Their order is
  meaningful; reversing them defines a different Prompt.
- `enabled` controls selection. Disabled records remain in version control and
  are still fully validated, but a Lobby selector never returns them.
- `metadata` is optional and maintainer-only. It accepts arbitrary keys whose
  values are strings. It is not used for routes, par, difficulty, or selection.
- Unknown document or Prompt fields are rejected so misspellings cannot be
  silently ignored.

Loading resolves both titles to canonical Playable Article identities
(`pageId` and canonical `title`). Validation rejects malformed records,
duplicate IDs, duplicate canonical ordered pairs, endpoints that resolve to the
same canonical article, non-playable endpoints, and seeds with no enabled
Prompt. A reverse canonical pair is allowed because Prompt order is meaningful.

## Validate a seed

Configure `WIKIMEDIA_USER_AGENT` in `wikiduel-server/.env` as documented in the
server README, then run this from the repository root:

```sh
npm run prompts:validate -- wikiduel-server/prompts/production.json
```

The command exits successfully only after JSON, structure, catalog-wide
uniqueness, and live Playable Article endpoint validation all pass. Failures
print a diagnostic code, JSON path, and explanation, for example:

```text
duplicate-id at $.prompts[4].id: Prompt ID 'example' duplicates $.prompts[1].id.
```

The command does not check reachability, route quality, difficulty, balance, or
editorial suitability. Those remain explicit maintainer responsibilities.

## Server integration

Import `loadPromptCatalog`, `createLobbyPromptSelector`, and their types from
`wikiduel-server/src/prompt-catalog/index.ts`. Create one selector per Lobby and
retain it across all Rounds and Rematch Duels. The selector uses every enabled
Prompt once before reshuffling. Creating a new selector gives a new Lobby the
full enabled catalog. Tests can inject a `random` function to make the order
deterministic.
