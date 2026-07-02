# wikiduel-server

Fastify and TypeScript backend for WikiDuel.

## Development

```sh
npm install
npm run dev
```

The server listens on `http://localhost:3000` by default. Set `PORT` or `HOST` to override the defaults.

The WebSocket endpoint is available at `ws://localhost:3000/ws`.

## Scripts

- `npm run dev` starts the server with file watching.
- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the compiled server.
- `npm test` runs the server tests.
- `npm run typecheck` checks TypeScript without emitting files.
