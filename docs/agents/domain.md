# Domain Docs

This is a single-context repository. Engineering skills should use the root domain glossary and root architectural decisions when exploring or changing the project.

## Before exploring

- Read [`CONTEXT.md`](../../CONTEXT.md) for canonical Wiki Duel terminology.
- Read relevant records under `docs/adr/` if that directory exists.

If an expected domain file or ADR directory does not exist, proceed silently. The domain-modeling workflow creates them lazily when terminology or a qualifying architectural decision is resolved.

## Layout

```text
/
|-- CONTEXT.md
|-- docs/
|   |-- adr/        # created only when a qualifying ADR is needed
|   `-- agents/
`-- ...
```

There is no `CONTEXT-MAP.md` and no separate client/server bounded context. The client and server implement the same Wiki Duel domain.

## Use the glossary's vocabulary

Use the canonical terms from `CONTEXT.md` in issue titles, acceptance criteria, tests, architecture proposals, and user-facing product documentation. Avoid synonyms explicitly listed under `_Avoid_`.

If a needed domain concept is absent, either reconsider whether it is truly project-specific or resolve it through domain modeling before adding it to the glossary.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface that conflict explicitly rather than silently overriding the prior decision.
