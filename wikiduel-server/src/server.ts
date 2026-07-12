import { buildApp } from "./app.js";
import { createLivePlayableArticleRepository } from "./playable-articles/index.js";

// Reject invalid live upstream identity before Fastify can accept connections.
const repository = createLivePlayableArticleRepository(process.env);
const app = await buildApp({
  repository,
  production: process.env.NODE_ENV === "production",
});
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
