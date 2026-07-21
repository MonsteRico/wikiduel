import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PlayableArticleRepository } from "../playable-articles/repository.js";
import {
  loadPromptCatalog,
  type PromptCatalogLoadResult,
} from "./catalog.js";

function displayPath(path: string | URL): string {
  return path instanceof URL ? fileURLToPath(path) : path;
}

export async function validatePromptCatalogFile(
  path: string | URL,
  articles: Pick<PlayableArticleRepository, "getByTitle">,
): Promise<PromptCatalogLoadResult> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [{
        code: "seed-file-unreadable",
        path: "$",
        message: `Could not read Prompt seed '${displayPath(path)}': ${reason}`,
      }],
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [{
        code: "invalid-json",
        path: "$",
        message: `Prompt seed '${displayPath(path)}' is not valid JSON: ${reason}`,
      }],
    };
  }

  return loadPromptCatalog(input, articles);
}
