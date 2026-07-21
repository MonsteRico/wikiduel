# wikiduel-server

Fastify and TypeScript backend for WikiDuel.

## Development

```sh
npm install
npm run dev
```

Run these commands from the repository root to install every workspace dependency and start both the client and server. To start only the server, run `npm run dev --workspace=wikiduel-server`.

The server listens on `http://localhost:3000` by default. Set `PORT` or `HOST` to override the defaults.

The WebSocket endpoint is available at `ws://localhost:3000/ws`.

Until the human-maintained production Prompt seed is available, non-production
startup uses the deterministic Prompt Catalog fixture for Duel development.
Production startup does not enable Duel creation without an injected validated
Prompt Catalog.

## Scripts

- `npm run dev` starts the server with file watching.
- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the compiled server.
- `npm test` runs the server tests.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run prompts:validate -- <seed-file>` validates a Prompt seed; see the
  [Prompt Catalog guide](../docs/prompt-catalog.md).
# Wiki Duel server

## Environment

Copy `.env.example` into your environment configuration and replace its contact
placeholder. Live startup requires `WIKIMEDIA_USER_AGENT` in the identifying
`Application/version (HTTPS contact URL or email)` form. The same value is sent
by both the `wikipedia` package and direct Wikimedia requests.

Set `WIKIMEDIA_LIVE_SMOKE=1` to include the minimal live Wikimedia smoke tests.
They are opt-in and intentionally excluded from deterministic CI runs.

## TypeScript imports

Local TypeScript imports intentionally use `.js` suffixes, for example
`./gateway.js`. The server uses Node's ESM-compatible `NodeNext` mode: TypeScript
resolves that specifier to `gateway.ts` while developing, then preserves it so
Node can load the emitted `gateway.js` at runtime.
