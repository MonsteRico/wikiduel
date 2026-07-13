# Establish Shared Client-Server Contracts

Status: completed
Scope: MVP required
Category: architecture

## Parent

- [ADR 0003](../../../docs/adr/0003-share-client-server-contracts-through-zod-schemas.md)
- [Duel Lifecycle spec](../../duel-lifecycle/spec.md)

## What to build

Establish a neutral workspace package that owns serialized client/server contracts through private strict Zod 4 schemas. Migrate the existing Lobby, Playable Article, preview, and transport message contracts so neither application imports the other's source or trusts unchecked JSON. Export inferred types and stable direction-specific decoders; later vertical slices will extend the same module with only the Duel messages they introduce.

## Acceptance criteria

- [x] One neutral workspace package owns the serialized Playable Article, Article Document, Lobby, preview, and current realtime message contracts.
- [x] Private strict Zod 4 schemas are the single source of truth and exported TypeScript contracts are inferred from them.
- [x] The module exposes stable client-message and server-message decode functions that accept `unknown` and return typed success or stable malformed-message failure.
- [x] Unknown message types, missing fields, wrong field types, invalid discriminated-union variants, and unexpected fields are rejected at the realtime seam.
- [x] Zod schemas and Zod error types do not become part of the consuming applications' interface.
- [x] The client and server import contracts only from the neutral package rather than each other's source trees or duplicated definitions.
- [x] Server-only repository, gateway, normalizer, cache, diagnostics, configuration, timer, and transition types remain private.
- [x] The browser production bundle contains no server runtime code.
- [x] Existing Lobby and Playable Article behavior remains unchanged while malformed-message coverage is strengthened on both receive paths.
- [x] Root install, test, lint, type-check, and build commands include and validate the new workspace package.

## Blocked by

- None — this is the recommended next implementation task.

## Out of scope

- Defining the entire future Duel protocol upfront
- Moving authoritative Lobby or Duel behavior into the contracts module
- Changing serialized product behavior except to reject malformed payloads consistently
- Adding HTTP mutation paths

Completed: 2026-07-13 16:35 -04:00

## Implementation notes

- Added the `@wikiduel/contracts` workspace with private strict Zod 4 schemas, inferred readonly contracts, and stable direction-specific decoders.
- Migrated client and server message/article imports to the neutral package and added strict malformed-message handling on both WebSocket receive paths.
- Validated with root typecheck, 182 passing tests, lint, build, and a production-bundle scan for server-only runtime signatures.

## Comments

- 2026-07-12: Supersedes `playable-articles/12` and expands the observed contract problem to the repository-wide realtime seam before Duel protocol growth.
