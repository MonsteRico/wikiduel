import { buildApp } from "./app.js";
import { createLivePlayableArticleRepository } from "./playable-articles/index.js";
import { validatePromptCatalogFile } from "./prompt-catalog/validation.js";

// Reject invalid live upstream identity before Fastify can accept connections.
const repository = createLivePlayableArticleRepository(process.env);
const promptCatalogResult = await validatePromptCatalogFile(
  new URL("../prompts/production.json", import.meta.url),
  repository,
);
if (!promptCatalogResult.ok) {
  throw new Error(`Production Prompt Catalog validation failed:\n${promptCatalogResult.diagnostics
    .map(({ code, path, message }) => `${code} at ${path}: ${message}`)
    .join("\n")}`);
}
const app = await buildApp({
  repository,
  promptCatalog: promptCatalogResult.catalog,
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
