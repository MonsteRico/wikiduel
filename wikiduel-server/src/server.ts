import { buildApp } from "./app.js";
import { loadWikimediaConfig } from "./playable-articles/config.js";

// Reject invalid live upstream identity before Fastify can accept connections.
loadWikimediaConfig(process.env);
const app = await buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
