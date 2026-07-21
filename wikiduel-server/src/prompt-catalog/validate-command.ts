import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { PlayableArticleRepository } from "../playable-articles/repository.js";
import { createLivePlayableArticleRepository } from "../playable-articles/index.js";
import { validatePromptCatalogFile } from "./validation.js";

export type PromptCatalogValidationCommandOptions = Readonly<{
  seedPath: string | URL;
  articles: Pick<PlayableArticleRepository, "getByTitle">;
  writeOutput: (line: string) => void;
  writeError: (line: string) => void;
}>;

export async function runPromptCatalogValidation(
  options: PromptCatalogValidationCommandOptions,
): Promise<0 | 1> {
  const result = await validatePromptCatalogFile(options.seedPath, options.articles);
  if (!result.ok) {
    result.diagnostics.forEach((item) => {
      options.writeError(`${item.code} at ${item.path}: ${item.message}`);
    });
    return 1;
  }

  const enabledCount = result.catalog.prompts.filter((prompt) => prompt.enabled).length;
  const total = result.catalog.prompts.length;
  options.writeOutput(
    `Validated ${total} Prompt${total === 1 ? "" : "s"} (${enabledCount} enabled).`,
  );
  return 0;
}

const invokedPath = process.argv[1];
const isMain = invokedPath !== undefined
  && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const seedPath = process.argv[2];
  if (seedPath === undefined) {
    process.stderr.write("Usage: npm run prompts:validate -- <seed-file>\n");
    process.exitCode = 2;
  } else {
    try {
      const articles = createLivePlayableArticleRepository(process.env);
      const resolvedSeedPath = resolve(process.env.INIT_CWD ?? process.cwd(), seedPath);
      process.exitCode = await runPromptCatalogValidation({
        seedPath: resolvedSeedPath,
        articles,
        writeOutput: (line) => process.stdout.write(`${line}\n`),
        writeError: (line) => process.stderr.write(`${line}\n`),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Prompt Catalog validation could not start: ${message}\n`);
      process.exitCode = 1;
    }
  }
}
