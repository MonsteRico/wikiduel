import type { NavigationDestination } from "@wikiduel/contracts";
import { describe, expect, test } from "vitest";

import type { PromptEndpointResolver } from "./catalog.js";
import { validatePromptCatalogFile } from "./validation.js";

const identities: Readonly<Record<string, NavigationDestination>> = {
  "Fixture Start": { pageId: 201, title: "Canonical Fixture Start" },
  "Fixture Target": { pageId: 202, title: "Canonical Fixture Target" },
};

const resolver: PromptEndpointResolver = {
  getByTitle: async (requestedTitle) => {
    const identity = identities[requestedTitle];
    return identity === undefined
      ? { ok: false, failure: { code: "article-not-found" } }
      : { ok: true, article: { identity } };
  },
};

describe("validatePromptCatalogFile", () => {
  test("loads and validates a seed file through the Prompt Catalog seam", async () => {
    const result = await validatePromptCatalogFile(
      new URL("./test-data/valid-seed.json", import.meta.url),
      resolver,
    );

    expect(result).toMatchObject({
      ok: true,
      catalog: {
        prompts: [{
          id: "fixture-file-prompt",
          start: { pageId: 201, title: "Canonical Fixture Start" },
          target: { pageId: 202, title: "Canonical Fixture Target" },
        }],
      },
    });
  });

  test("reports invalid JSON without attempting endpoint validation", async () => {
    const result = await validatePromptCatalogFile(
      new URL("./test-data/invalid-json.json", import.meta.url),
      resolver,
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{
        code: "invalid-json",
        path: "$",
        message: expect.stringContaining("invalid-json.json"),
      }],
    });
  });
});
