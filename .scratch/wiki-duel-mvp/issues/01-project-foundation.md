# Project Foundation

Status: ready-for-agent

## Goal

Create a production-shaped but feature-light Wiki Duel workspace that proves the chosen architecture can build, test, run locally, connect to Postgres, serve the SPA from Fastify, and establish a typed Socket.IO connection. Do not implement Lobby or Duel behavior in this goal.

## Agent Prompt

```text
Implement the Project Foundation issue end to end. Read the linked PRD, glossary, and ADRs before editing. Scaffold the npm workspace and deliver the web shell, Fastify/Socket.IO foundation, Zod contracts, validated environment setup, Postgres/Drizzle migration infrastructure, Docker topology, CI, documentation, and focused tests described here. Keep the result production-shaped but feature-light: do not implement Lobby, Wikipedia, Navigation, Round, HP, damage, analytics, or other gameplay behavior. Work through verification until the documented root lint, typecheck, test, and build commands pass, and report any command that cannot be run.
```

## Read First

- [`PRD.md`](../PRD.md)
- [`CONTEXT.md`](../../../CONTEXT.md)
- [`ADR-0001`](../../../docs/adr/0001-keep-active-duels-in-memory.md)
- [`ADR-0002`](../../../docs/adr/0002-use-a-workspace-monorepo.md)
- [`ADR-0003`](../../../docs/adr/0003-serve-the-spa-from-fastify.md)
- [`ADR-0004`](../../../docs/adr/0004-isolate-the-authoritative-duel-core.md)

## Scope

### Workspace

- Pin Node 24 LTS and npm workspaces.
- Create `apps/web`, `apps/server`, and `packages/contracts`.
- Configure strict TypeScript project references or equivalent workspace-safe builds.
- Add root scripts for `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e` (the E2E script may run a minimal foundation smoke test).
- Configure ESLint flat config, Prettier, Vitest, and Playwright without duplicating per-package policy unnecessarily.

### Contracts

- Use Zod in `packages/contracts`.
- Define only a minimal typed connection-status/handshake contract and shared opaque ID primitives needed by the foundation.
- Do not add Lobby, Round, Navigation, Damage Rule, or prompt schemas yet.

### Server

- Create a Fastify application factory that is testable without binding a port.
- Add redacted structured logging and baseline security headers/request limits.
- Validate configuration with `@t3-oss/env-core` and Zod.
- Add `/health/live` and `/health/ready`; readiness checks Postgres.
- Attach Socket.IO and implement a typed connection-status handshake only.
- In production, serve the built Vite SPA and support client-side route fallback without swallowing API or socket routes.
- Keep transport wiring modular so later authoritative core modules do not live inside handlers.

### Web

- Create the Vite React TypeScript app with routing, Zustand, Tailwind, and selectively installed shadcn/ui primitives.
- Establish distinctive design tokens based on the mockup: dark competitive shell, light editorial surface, stable blue/red accents, and accessible focus/status tokens.
- Build a polished placeholder home/app shell with disabled or clearly nonfunctional `Create Lobby` and `Join Lobby` affordances; do not fake feature completion.
- Add error and not-found states, connection status, and an unsupported-width message below 1024px.
- Use shadcn behavior selectively; do not leave default shadcn visual styling as the product identity.

### Database and Environment

- Configure Drizzle and Postgres connectivity plus committed migration infrastructure.
- Do not create dummy permanent domain tables or the full MVP schema.
- A readiness query and migration/tooling test are sufficient for this goal.
- Commit `.env.example` files with documented server/client exposure. No secrets may be exposed through Vite variables.
- Fail startup on invalid required configuration.

### Docker and CI

- Add Docker Compose for local Postgres.
- Add a production multi-stage Dockerfile that builds all workspaces, builds the SPA, runs migrations, and starts Fastify as the single application container.
- Add a production-like Compose configuration for application plus Postgres that is suitable for later Dokploy use.
- Add GitHub Actions for clean install, lint, typecheck, unit/integration tests, and production build on pushes and pull requests.
- Document local development as explicit infrastructure and app commands; a single magic command is not required.

### Documentation

- Add a concise root README with prerequisites, environment setup, local commands, test/build commands, migration commands, and production Compose verification.
- State clearly that this foundation does not yet create Lobbies or run Duels.

## Out of Scope

- Lobby codes, invite links, Player Session tokens, readiness, settings, or reconnect lifecycle
- Wikipedia fetching, sanitization, caching, attribution, prompt data, or article UI
- Authoritative Duel state, Navigation, timers, HP, damage, summaries, feedback, or analytics
- Redis, accounts, mobile UI, admin UI, production deployment, or public testing
- Full domain database schema

## Acceptance Criteria

- A clean checkout on Node 24 can install with npm and run the documented local Postgres and workspace dev commands.
- The web shell loads at desktop width, communicates connection state accessibly, and shows the explicit unsupported message below 1024px.
- `/health/live` succeeds when the process is running.
- `/health/ready` succeeds with Postgres available and fails meaningfully without it.
- A browser establishes the typed Socket.IO handshake; invalid handshake payloads fail schema validation in tests.
- The production image builds once and serves the SPA, HTTP health routes, and Socket.IO from one origin.
- The application container runs committed Drizzle migrations before Fastify starts and fails cleanly if migration fails.
- No permanent dummy/domain table exists solely to prove migrations.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass at the repository root.
- CI runs the same foundation checks.
- Tests cover the Fastify factory/health behavior, database readiness behavior, contract parsing, and socket handshake.
- The implementation does not contain placeholder Lobby or Duel rules that later goals must unwind.

## Implementation Guidance

Prefer current stable package releases compatible with Node 24. Keep dependencies minimal, preserve the module boundaries in the ADRs, and use the mockup as visual direction rather than reproducing its now-superseded round-count/settings details.

## Comments
