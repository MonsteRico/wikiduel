import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { resolvePromptCatalogPath } from "./config.js";
import { validatePromptCatalogFile } from "./validation.js";

test("development loads the five requested pairs through the catalog validator", async () => {
  const path = resolvePromptCatalogPath(["--development"], {}, process.cwd());
  let pageId = 0;
  const result = await validatePromptCatalogFile(path, {
    getByTitle: async (title) => ({
      ok: true,
      article: { identity: { pageId: ++pageId, title } },
    }),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.catalog.prompts.map(({ start, target, enabled }) => [start.title, target.title, enabled]))
    .toEqual([
      ["United States", "Christianity", true],
      ["Cat", "Dog", true],
      ["Cow", "Milk", true],
      ["Steam (service)", "Nintendo", true],
      ["GitHub", "Microsoft", true],
    ]);
});

test("normal startup uses production regardless of working directory", () => {
  expect(resolvePromptCatalogPath([], {}, resolve("elsewhere"))).toBe(
    fileURLToPath(new URL("../../prompts/production.json", import.meta.url)),
  );
});

test("explicit paths override development and resolve from the caller directory", () => {
  const cwd = resolve("custom directory");
  expect(resolvePromptCatalogPath(["--development", "production.json"], {}, cwd))
    .toBe(resolve(cwd, "production.json"));
  const absolute = resolve("prompt lists/production.json");
  expect(resolvePromptCatalogPath(["--development"], { WIKIDUEL_PROMPT_FILE: absolute }, cwd))
    .toBe(absolute);
});

test("invalid arguments fail instead of silently loading a default", () => {
  expect(() => resolvePromptCatalogPath(["one.json", "two.json"], {}, process.cwd())).toThrow();
  expect(() => resolvePromptCatalogPath(["--develompent"], {}, process.cwd())).toThrow();
  expect(() => resolvePromptCatalogPath([], { WIKIDUEL_PROMPT_FILE: " " }, process.cwd())).toThrow();
});
