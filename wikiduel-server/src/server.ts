import { buildApp } from "./app.js";
import { createLivePlayableArticleRepository } from "./playable-articles/index.js";

// Construct all live upstream boundaries before Fastify can accept connections.
// Duel/preview delivery will consume this repository in their dedicated issues.
void createLivePlayableArticleRepository(process.env);
const app = await buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
