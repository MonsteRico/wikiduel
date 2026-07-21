import { describe, expect, test } from "vitest";

import type { PromptEndpointResolver } from "./catalog.js";
import { runPromptCatalogValidation } from "./validate-command.js";

const resolver: PromptEndpointResolver = {
  getByTitle: async (requestedTitle) => ({
    ok: true,
    article: {
      identity: requestedTitle === "Fixture Start"
        ? { pageId: 201, title: "Canonical Fixture Start" }
        : { pageId: 202, title: "Canonical Fixture Target" },
    },
  }),
};

describe("runPromptCatalogValidation", () => {
  test("returns success for a valid seed and failure with diagnostics for an invalid seed", async () => {
    const standardOutput: string[] = [];
    const errorOutput: string[] = [];

    const success = await runPromptCatalogValidation({
      seedPath: new URL("./test-data/valid-seed.json", import.meta.url),
      resolver,
      writeOutput: (line) => standardOutput.push(line),
      writeError: (line) => errorOutput.push(line),
    });
    const failure = await runPromptCatalogValidation({
      seedPath: new URL("./test-data/invalid-json.json", import.meta.url),
      resolver,
      writeOutput: (line) => standardOutput.push(line),
      writeError: (line) => errorOutput.push(line),
    });

    expect(success).toBe(0);
    expect(standardOutput).toEqual([
      expect.stringContaining("Validated 1 Prompt (1 enabled)"),
    ]);
    expect(failure).toBe(1);
    expect(errorOutput).toEqual([
      expect.stringContaining("invalid-json at $"),
    ]);
  });
});
