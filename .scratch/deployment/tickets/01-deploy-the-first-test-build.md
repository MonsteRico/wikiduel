# Deploy the First-Test Build

Status: completed
Completed: 2026-10-02 01:55 PM on master, live checks and automatic redeployment verified
Scope: MVP required
Category: enhancement

## What to build

Prepare a Dockerfile and the application changes needed for Dokploy to build and deploy Wiki Duel automatically when commits reach `master`. Run the client, Fastify server, and WebSocket endpoint as one application with one origin and one backend instance. No database is required.

The agent owns the deployment files, application changes, local validation, and setup walkthrough. The maintainer applies all Dokploy settings and manages the URL, domain, and DNS. After setup, the agent helps the maintainer verify the live deployment and automatic redeployment. Anyone with the URL can access the existing anonymous Lobby flow; no additional access gate is required.

Repository implementation, maintainer setup, live verification and automatic redeployment are complete. The evidence is recorded below.

## Acceptance criteria

- [x] A Dockerfile and `.dockerignore` support a clean Linux build from the repository root using the committed lockfile. The image includes the built client, runnable server, shared contracts, production dependencies, and production Prompt catalog. Building the image does not require live Wikimedia access.
- [x] The image starts with injected runtime environment variables and does not require a local `.env` file. Secrets, local configuration, and development-only assets are excluded from the image where unnecessary at runtime.
- [x] Fastify serves the built SPA and `/ws` behind Dokploy's proxy and TLS termination. Production clients derive the WebSocket URL from the page origin, including its port, and use `wss` over HTTPS. Existing local development configuration still works.
- [x] Direct navigation and refresh on supported client routes return the SPA. Missing assets and unknown server endpoints do not silently return HTML. Development lab routes are unavailable in the production build.
- [x] Liveness and readiness checks have documented paths and behavior. Readiness requires successful application initialization, including production Prompt validation. Container startup and Dokploy health settings allow for that validation; failed initialization does not report ready.
- [x] A deployment walkthrough gives the maintainer the exact repository-root build context, Dockerfile path, application port, runtime variables, health settings, and proxy/WebSocket requirements. It covers `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT`, and a valid identifying `WIKIMEDIA_USER_AGENT` with contact information. No credentials are committed.
- [x] The walkthrough explains how the maintainer connects the repository to Dokploy, selects `master`, and enables automatic deployment on pushes. It documents any provider permissions or webhook setup required by the chosen integration. URL/domain setup remains with the maintainer.
- [x] A clean container build and local container smoke check pass. Relevant tests, typecheck, lint, and the workspace build pass. Record commands and results in the implementation PR.
- [x] After the maintainer applies the settings, the deployed HTTPS page, secure WebSocket connection, direct-route refresh, and health endpoints are verified at the supplied URL.
- [x] Two remote desktop browser sessions create/join a Lobby, start a Duel, navigate articles, resolve rounds, complete a Duel, and exercise rematch or return to Lobby. Verify the existing departure/disconnect behavior through the deployed proxy. Record who performed the checks and the result.
- [x] A subsequent commit to `master` triggers deployment without a manual deploy action. Record the deployed commit and successful post-deployment health and connection checks.

## Implementation notes

- Prefer Dokploy's repository integration and Dockerfile build. Add a separate image registry or CI publishing workflow only if a concrete deployment constraint requires one.
- Verify the runtime packaging of `@wikiduel/contracts`. Its current package exports point at TypeScript source, so copying only workspace `dist` directories is not sufficient by itself.
- Preserve the production Prompt catalog's runtime path and startup validation. Document the runtime's need to reach Wikimedia.
- Keep the current `tsc` and native ESM build if it packages cleanly. Introduce bundling only to solve a demonstrated runtime or packaging problem, not to remove `.js` import suffixes.
- Automatic deployments restart the single process. In-memory Lobbies and active Duels are lost during a deployment. Document that behavior and a simple procedure to redeploy a previous known-good commit.
- Check the working tree before implementation. Development launcher and Prompt catalog configuration changes were still local during refinement; preserve them and establish which changes have reached `master` before editing overlapping files.

## Blocked by

None. The maintainer applied Dokploy settings and all deployment acceptance checks passed.

## Out of scope

- Postgres or another durable service
- Multiple backend instances
- Zero-downtime active-Duel migration
- Full production operations or autoscaling
- Additional authentication or an access gate
- Agent administration of Dokploy, DNS, or domain settings

## Comments

- 2026-10-02 01:55 PM: Automatic redeployment verified for `4693c240697a61f82f11d11ccd107a76577fb6c8`. Matthew watched Dokploy immediately pick up the push without pressing Deploy. Codex observed both existing browser connections disconnect during the restart, then reran `node scripts/smoke-deployment.mjs https://wikiduel.matthewgardner.dev` successfully. Both reloaded browser sessions connected and created/joined fresh Lobby `823WP`, with two connected players. Test tabs were closed afterward. All acceptance criteria passed; ticket completed.

- 2026-10-02: Live verification passed at `https://wikiduel.matthewgardner.dev`. Matthew confirmed Auto Deploy is enabled and Dokploy reports deployed commit `26167d641a006154151f9b17962eca2b29907ac2`. Codex ran `node scripts/smoke-deployment.mjs https://wikiduel.matthewgardner.dev`; HTTPS health/readiness, supported routes, missing assets/endpoints, disabled `/lab` and the secure WebSocket welcome all passed. Direct browser visits to Lobby and Duel routes loaded the SPA, and refresh loaded the client without a server 404. A discarded Player Session does not regain its previous Duel on refresh.
- 2026-10-02: Codex operated two separate player tabs in the desktop in-app browser against the remote deployment. Lobby `J8EQW` and Duel `3001dbb6-525b-4965-a551-fa813fb2f41c` passed create/join, readiness, article loading, independent Navigation, synchronized Round Outcomes and Duel completion. Winning paths were Jack Black to Super Bowl XLIII to Super Bowl to Patrick Mahomes; Nintendo to Playing card to Paper to Hardwood to Oak; and YouTube to Nintendo to Kyoto. Damage was 16, 60 and 25, ending at Host 0 HP and Opponent 100 HP. The Host deliberately navigated Nintendo/Sony repeatedly in Round two to exercise Navigation and the damage cap. Both players requested a rematch, which created a fresh Duel with 100 HP each. Closing the opponent tab during the active rematch returned the survivor home with the disconnect Forfeit notice. Explicit departure from matched Lobby `7P87X` closed it for both players. No browser console warnings or errors were observed during the Duel. Automatic redeployment verification remains pending.

- 2026-10-02: Maintainer plans to host at `https://wikiduel.matthewgardner.dev`; Dokploy setup is still pending. Standards and Spec reviews of `7491640...ad970cc` each returned zero findings. An additional container check with a missing Prompt catalog exited before listening, as required.

- 2026-10-02: Repository implementation on `master` adds the multi-stage Docker image, SPA routes, same-origin production WebSockets, readiness check, and [Dokploy walkthrough](../../../docs/deployment.md). The existing launcher and Prompt configuration were committed separately as `7491640`, with maintainer approval. No PR was opened because this work was requested directly on `master`.
- 2026-10-02: Codex verified `npm ci`, `npm test` with 318 passed and one skipped, `npm run typecheck`, `npm run lint`, and `npm run build`. Lint exits successfully with one warning in unchanged `wikiduel-client/src/pages/HomePage.tsx`. The lockfile was regenerated in clean Linux to restore missing native platform packages and a consistent workspace install layout. This also refreshes versions within the existing manifest ranges.
- 2026-10-02: `docker build --no-cache -t wikiduel:first-test .` passed. The container validated the packaged production Prompts against Wikimedia, listened on port 3000 and reported healthy. `node scripts/smoke-deployment.mjs` passed through host port 8080 for health, readiness, SPA routes, missing assets/endpoints, disabled `/lab`, and the WebSocket welcome. Codex's in-app desktop browser loaded the production page at `http://localhost:8080` and displayed Server connected without console warnings or errors. A container without `WIKIMEDIA_USER_AGENT` exited before listening. Image inspection confirmed no local `.env`, development Prompt catalog, contract sources, test JavaScript or TypeScript compiler.
- 2026-10-02: Still pending: maintainer Dokploy setup, supplied HTTPS URL, remote two-player browser acceptance and proof that a later push to `master` triggers redeployment. Keep `ready-for-human` until those pass. Record tester names, deployed SHAs and live results here.

- 2026-07-03: Deployment is MVP required because Dokploy is how the first small-group test will access the game.
- 2026-10-02: Maintainer confirmed live deployment and verification, automatic deployments from `master`, and public access without an additional gate. The agent prepares deployment files and a walkthrough; the maintainer applies all Dokploy settings and owns URL/domain setup. The Dockerfile and automatic deployment setup are the main implementation work.
- 2026-07-04: Re-evaluate the server build strategy while designing the Docker image. The server currently uses `tsc` with `module: NodeNext`, emits native ESM, and runs the output directly in Node; this is why local TypeScript imports use explicit `.js` suffixes. Docker does not itself require bundling—a multi-stage image can compile with `tsc` and copy the server output plus production dependencies—but deployment may reveal concrete reasons to introduce esbuild, tsup, or similar tooling, such as image size, simpler workspace dependency copying, startup constraints, or the target platform's packaging requirements. Choose between direct `tsc` output and a bundled server using measured deployment needs rather than changing the build solely to remove `.js` suffixes.
