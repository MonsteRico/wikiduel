# Deploy the First-Test Build

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Package and deploy the client, Fastify server, and WebSocket endpoint as one Dockerized application suitable for the project's Dokploy server. The deployed build must use one origin and require no database or other application service.

## Acceptance criteria

- [ ] One reproducible container build produces the client and server runtime.
- [ ] Fastify serves the built SPA and same-origin WebSocket endpoint correctly behind Dokploy's proxy and TLS termination.
- [ ] Direct navigation to client routes returns the SPA.
- [ ] Runtime configuration is documented and contains no committed secrets.
- [ ] Liveness and application-readiness endpoints work in the deployed environment.
- [ ] Two remote desktop browsers can create/join a Lobby and complete the required critical flow.

## Blocked by

- A stable required-MVP critical flow.

## Out of scope

- Postgres or another durable service
- Multiple backend instances
- Zero-downtime active-Duel migration
- Full production operations or autoscaling

## Comments

- 2026-07-03: Deployment is MVP required because Dokploy is how the first small-group test will access the game.
