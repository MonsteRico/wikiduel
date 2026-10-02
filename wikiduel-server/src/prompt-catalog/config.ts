import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export function resolvePromptCatalogPath(
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { development: { type: "boolean", default: false } },
  });
  if (positionals.length > 1) {
    throw new Error("Expected at most one Prompt seed path.");
  }
  const override = positionals[0] ?? env.WIKIDUEL_PROMPT_FILE;
  if (override !== undefined) {
    if (!override.trim()) throw new Error("Prompt seed path must not be empty.");
    return resolve(cwd, override);
  }
  return fileURLToPath(new URL(
    values.development ? "../../prompts/development.json" : "../../prompts/production.json",
    import.meta.url,
  ));
}
