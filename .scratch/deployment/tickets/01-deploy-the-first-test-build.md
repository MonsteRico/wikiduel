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
- 2026-07-04: Re-evaluate the server build strategy while designing the Docker image. The server currently uses `tsc` with `module: NodeNext`, emits native ESM, and runs the output directly in Node; this is why local TypeScript imports use explicit `.js` suffixes. Docker does not itself require bundling—a multi-stage image can compile with `tsc` and copy the server output plus production dependencies—but deployment may reveal concrete reasons to introduce esbuild, tsup, or similar tooling, such as image size, simpler workspace dependency copying, startup constraints, or the target platform's packaging requirements. Choose between direct `tsc` output and a bundled server using measured deployment needs rather than changing the build solely to remove `.js` suffixes.
