# Deploy the first test build

Wiki Duel runs one Node process containing the client, Fastify HTTP routes and
`/ws`. Lobbies and Duels live in memory. Every restart or deployment disconnects
players and loses that state. Arrange deployments between playtests.

## Connect Dokploy

The maintainer applies these settings and manages the URL, TLS, domain and DNS.

1. In Dokploy's Git sources, create a GitHub App for the account or organization
   that owns this repository. Install it with access to this repository. Accept
   the generated app's repository permissions and push-event subscription. An
   organization owner may need to approve the installation. No token belongs in
   this repository. See [Dokploy's GitHub setup](https://docs.dokploy.com/docs/core/github).
2. Create a project and an Application. Select the GitHub provider, the installed
   app, this repository and branch `master`. Set the repository build path to `/`.
3. Select Dockerfile build with the settings below. Save and enable Auto Deploy
   in General. The GitHub App integration handles push delivery without a separate
   repository webhook. Leave watch paths unset so every push to `master` qualifies.
   See [Auto Deploy](https://docs.dokploy.com/docs/core/auto-deploy).
4. Set the runtime environment, domain and health settings below, then perform
   the first deployment. Watch the logs until Prompt validation finishes and the
   server starts listening. Supply the HTTPS URL for the live checks.

If using Dokploy's generic Git provider instead, copy its deployment webhook URL
from Deployments into GitHub repository Settings, Webhooks. Use JSON payloads and
push events, enable Auto Deploy and select `master`. Repository webhook management
requires repository administration permission. Keep that trigger URL private.

## Build and runtime settings

| Setting | Value |
| --- | --- |
| Repository build path | `/` |
| Docker context path | `.` |
| Dockerfile path | `Dockerfile` |
| Docker build stage | `runtime`, or leave empty to use the final stage |
| Container/application port | `3000` |
| Replicas | `1` |
| Update order | `stop-first` |
| Runtime command | Leave the image default |
| Volumes or database | None |

These field names follow [Dokploy's Dockerfile settings](https://docs.dokploy.com/docs/core/applications/build-type).
Do not select the static-site build type or run a separate Vite server.

Set runtime variables in Dokploy, not Docker build arguments:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
WIKIMEDIA_USER_AGENT=WikiDuel/0.1 (https://github.com/MonsteRico/wikiduel)
```

Use a contact URL you maintain, or replace the parenthesized URL with your real
email address. The server rejects generic or malformed identities. Leave
`WIKIDUEL_PROMPT_FILE` unset to use the packaged production catalog. No `.env`
file is needed. `VITE_WS_URL` applies only to development; production derives
`ws` or `wss`, hostname and port from the page origin.

The build uses `npm ci` and the committed lockfile. It downloads dependencies but
does not contact Wikimedia. Runtime needs outbound HTTPS and DNS access to
Wikimedia for startup Prompt validation and article navigation. The image keeps
native ESM, changes the packaged contracts export to `dist/index.js`, and copies
only compiled code, production dependencies, client assets and production Prompts.

## Proxy and health

Route the whole host, starting at `/`, to container port `3000` using HTTP inside
Dokploy. Terminate TLS at its proxy and enable HTTPS for the public URL. Preserve
`/ws` and WebSocket Upgrade headers. Do not strip a path prefix or put HTTP-only
middleware in front of `/ws`. Any additional proxy must support long-lived
WebSocket connections. The application is anonymous and accessible to anyone
with its URL.

`GET /health` returns HTTP 200 and `{"status":"ok"}` when Fastify is listening.
`GET /ready` returns HTTP 200 and `{"status":"ready"}` after initialization.
Startup validates every production Prompt before opening the listening port.
During validation, both endpoints refuse connections. Failed validation exits
the process without ever reporting ready. An app missing its initialized
repository or catalog returns 503 from `/ready`. Checks do not query Wikimedia
again on each request.

Keep the Dockerfile healthcheck, which probes `/ready` with Node. It allows five
minutes for startup, then uses a 30-second interval, five-second timeout and three
retries. The image has no curl. If Dokploy overrides the image healthcheck, use
this in Advanced, Cluster Settings, Swarm Settings, Health Check:

```json
{
  "Test": ["CMD", "node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],
  "Interval": 30000000000,
  "Timeout": 5000000000,
  "StartPeriod": 300000000000,
  "Retries": 3
}
```

Use one replica and `stop-first` update and rollback ordering. Set any deployment
startup deadline to at least 420 seconds. Allow a gap in availability during
deployment. Do not enable overlapping instances to hide that gap, since players
on different processes cannot share a Lobby. Dokploy's
[health settings guide](https://docs.dokploy.com/docs/core/applications/going-production)
describes the Swarm fields. Its example uses `start-first`; use `stop-first` here.

## Local validation

Run from the repository root with Docker's Linux engine running:

```sh
npm test
npm run typecheck
npm run lint
npm run build
docker build --no-cache -t wikiduel:first-test .
docker run --rm --name wikiduel-first-test -p 127.0.0.1:8080:3000 -e "WIKIMEDIA_USER_AGENT=WikiDuel/0.1 (https://github.com/MonsteRico/wikiduel)" wikiduel:first-test
```

In another terminal, check `http://localhost:8080/health`, `/ready`, `/`,
`/lobby/ABCDE` and `/duel/example`. Client routes should return HTML. `/lab`,
`/assets/missing.js` and `/api/unknown` must return 404, not the SPA. Open the
page in a browser and confirm the connection uses `ws://localhost:8080/ws`.
Stop the container with `docker stop wikiduel-first-test`.

Run `node scripts/smoke-deployment.mjs` for the HTTP and WebSocket checks above.
Pass the deployed HTTPS origin as its argument to repeat them through Dokploy.
The script requires Node 24 and does not replace the two-player browser checks.

## Live acceptance and automatic redeployment

Record the date, tester names, URL, browser versions and deployed commit in the
[ticket](../.scratch/deployment/tickets/01-deploy-the-first-test-build.md).

1. Check HTTPS without certificate warnings, both health endpoints, direct Lobby
   and Duel route refresh, a missing asset and `/lab`. In browser network tools,
   verify `/ws` uses `wss` on the page's host and port and upgrades successfully.
2. Use two remote desktop browser sessions. Create and join a Lobby, ready both
   players, start a Duel, navigate articles, resolve rounds and complete the
   Duel. Exercise rematch or return to Lobby.
3. Exercise explicit departure and close one player's browser during a Duel.
   Verify the other player sees the existing departure or Forfeit behavior and
   the Lobby closes. Confirm this through the deployed proxy, not localhost.
4. Push a subsequent small commit to `master`. Do not press Deploy. Confirm that
   Dokploy receives the push, builds that commit and replaces the running process.
   Record the commit from its deployment record. Repeat health and secure
   connection checks, then create and join a fresh Lobby.

Keep the ticket `ready-for-human` until all these checks pass.

## Restore a known-good version

Record the known-good SHA before each playtest. If a deployment fails, stop the
playtest and temporarily disable Auto Deploy. Use Dokploy's retained successful
deployment rollback when available, keeping one replica and `stop-first`.
Otherwise revert the bad commit or commits on `master` with Git, review the
result, push and deploy that revert. Re-enable Auto Deploy after recovery and
verify `/ready` plus a fresh WebSocket connection. Restoring code cannot restore
in-memory Lobbies or Duels.
