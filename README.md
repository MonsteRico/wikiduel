# Wiki Duel

Wiki Duel is a competitive Wikipedia racing game with a React client and a Fastify server.

## Development

Install all client, server, and root tooling dependencies from the repository root:

```sh
npm install
```

Start both development servers:

```sh
npm run dev
```

The client runs on Vite's default development URL and the server listens on `http://localhost:3000` by default.

Development uses the five easier Prompts in `wikiduel-server/prompts/development.json`.
Pass a JSON seed path to use another catalog, such as production:

```sh
npm run dev -- wikiduel-server/prompts/production.json
```

Paths are relative to the repository root. Absolute paths also work; quote paths
containing spaces. See the [Prompt Catalog guide](docs/prompt-catalog.md) for the JSON format.

## Commands

- `npm run dev` starts the client and server in watch mode.
- `npm test` runs both Vitest projects once.
- `npm run test:ui` opens the Vitest UI for both projects.
- `npm run test:watch` watches both Vitest projects.
- `npm run typecheck` type-checks both workspaces.
- `npm run build` builds both workspaces.
- `npm run lint` runs each available workspace lint script.

Add `--workspace=wikiduel-client` or `--workspace=wikiduel-server` to run a workspace script directly.
