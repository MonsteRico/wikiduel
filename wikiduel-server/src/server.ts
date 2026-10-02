import { buildApp } from "./app.js";
import { createLivePlayableArticleRepository } from "./playable-articles/index.js";
import { validatePromptCatalogFile } from "./prompt-catalog/validation.js";
import { createLivePromptEndpointResolver } from "./prompt-catalog/live-resolver.js";
import { resolvePromptCatalogPath } from "./prompt-catalog/config.js";

// Reject invalid live upstream identity before Fastify can accept connections.
const repository = createLivePlayableArticleRepository(process.env);
const promptCatalogPath = resolvePromptCatalogPath(process.argv.slice(2), process.env, process.cwd());
console.info(`Loading Prompt Catalog: ${promptCatalogPath}`);
const promptCatalogResult = await validatePromptCatalogFile(
  promptCatalogPath,
  createLivePromptEndpointResolver(process.env),
);
if (!promptCatalogResult.ok) {
  throw new Error(`Prompt Catalog validation failed for '${promptCatalogPath}':\n${promptCatalogResult.diagnostics
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
