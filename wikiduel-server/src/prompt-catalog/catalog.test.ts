import type { PlayableArticle } from "@wikiduel/contracts";
import { describe, expect, test } from "vitest";

import type { PlayableArticleRepository } from "../playable-articles/repository.js";
import { loadPromptCatalog } from "./catalog.js";

function playableArticle(pageId: number, title: string): PlayableArticle {
  return {
    identity: { pageId, title },
    revision: { id: 1, timestamp: "2026-07-20T12:00:00Z" },
    attribution: {
      sourceUrl: `https://en.wikipedia.org/wiki/${title}`,
      historyUrl: `https://en.wikipedia.org/w/index.php?title=${title}&action=history`,
      licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      modificationNotice: "Wiki Duel simplified and modified this Wikipedia article.",
    },
    document: { title, tableOfContents: [], blocks: [] },
  };
}

function repositoryWith(
  identities: Readonly<Record<string, Readonly<{ pageId: number; title: string }>>>,
): PlayableArticleRepository {
  return {
    getByTitle: async (requestedTitle) => {
      const identity = identities[requestedTitle];
      return identity
        ? { ok: true, article: playableArticle(identity.pageId, identity.title) }
        : { ok: false, failure: { code: "article-not-found" } };
    },
  };
}

describe("loadPromptCatalog", () => {
  test("loads ordered Prompts with canonical Playable Article identities", async () => {
    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          {
            id: "computing-foundations",
            start: "Analytical Engine",
            target: "Computer science",
            enabled: true,
            metadata: { notes: "Maintainer-authored note", category: "computing" },
          },
        ],
      },
      repositoryWith({
        "Analytical Engine": { pageId: 1210, title: "Analytical engine" },
        "Computer science": { pageId: 5323, title: "Computer science" },
      }),
    );

    expect(result).toEqual({
      ok: true,
      catalog: {
        prompts: [
          {
            id: "computing-foundations",
            start: { pageId: 1210, title: "Analytical engine" },
            target: { pageId: 5323, title: "Computer science" },
            enabled: true,
            metadata: { notes: "Maintainer-authored note", category: "computing" },
          },
        ],
      },
    });
  });

  test("rejects malformed seed fields with record-local diagnostics", async () => {
    const result = await loadPromptCatalog(
      {
        version: 2,
        prompts: [
          {
            id: "",
            start: "",
            target: "Target",
            enabled: "yes",
            metadata: { notes: 42 },
            unexpected: true,
          },
          null,
        ],
      },
      repositoryWith({}),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        { code: "unsupported-version", path: "$.version" },
        { code: "invalid-field", path: "$.prompts[0].id" },
        { code: "invalid-field", path: "$.prompts[0].start" },
        { code: "invalid-field", path: "$.prompts[0].enabled" },
        { code: "invalid-field", path: "$.prompts[0].metadata.notes" },
        { code: "unknown-field", path: "$.prompts[0].unexpected" },
        { code: "invalid-record", path: "$.prompts[1]" },
      ].map((expected) => expect.objectContaining(expected))));
    }
  });

  test("rejects duplicate stable Prompt IDs before endpoint lookup", async () => {
    let lookupCount = 0;
    const repository: PlayableArticleRepository = {
      getByTitle: async () => {
        lookupCount += 1;
        return { ok: false, failure: { code: "article-not-found" } };
      },
    };

    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          { id: "same-id", start: "One", target: "Two", enabled: true },
          { id: "same-id", start: "Three", target: "Four", enabled: false },
        ],
      },
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{
        code: "duplicate-id",
        path: "$.prompts[1].id",
        message: expect.stringContaining("same-id"),
      }],
    });
    expect(lookupCount).toBe(0);
  });

  test("reports each endpoint that does not resolve to a Playable Article", async () => {
    const repository: PlayableArticleRepository = {
      getByTitle: async (requestedTitle) => requestedTitle === "Missing"
        ? { ok: false, failure: { code: "article-not-found" } }
        : {
            ok: false,
            failure: { code: "article-not-playable", reason: "disambiguation" },
          },
    };

    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          { id: "bad-endpoints", start: "Missing", target: "Ambiguous", enabled: true },
        ],
      },
      repository,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "endpoint-not-playable",
          path: "$.prompts[0].start",
          message: expect.stringContaining("article-not-found"),
        }),
        expect.objectContaining({
          code: "endpoint-not-playable",
          path: "$.prompts[0].target",
          message: expect.stringContaining("article-not-playable (disambiguation)"),
        }),
      ]);
    }
  });

  test("rejects endpoints that collapse to the same canonical article", async () => {
    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          {
            id: "collapsed",
            start: "USA",
            target: "United States of America",
            enabled: true,
          },
        ],
      },
      repositoryWith({
        USA: { pageId: 3434750, title: "United States" },
        "United States of America": { pageId: 3434750, title: "United States" },
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{
        code: "identical-endpoints",
        path: "$.prompts[0].target",
        message: expect.stringContaining("United States"),
      }],
    });
  });

  test("rejects duplicate canonical ordered pairs while allowing their reverse", async () => {
    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          { id: "first", start: "A", target: "B", enabled: true },
          { id: "duplicate", start: "Alias A", target: "Alias B", enabled: false },
          { id: "reverse", start: "B", target: "A", enabled: true },
        ],
      },
      repositoryWith({
        A: { pageId: 1, title: "Article A" },
        "Alias A": { pageId: 1, title: "Article A" },
        B: { pageId: 2, title: "Article B" },
        "Alias B": { pageId: 2, title: "Article B" },
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{
        code: "duplicate-ordered-pair",
        path: "$.prompts[1]",
        message: expect.stringContaining("first"),
      }],
    });
  });

  test("rejects a catalog with no enabled Prompt", async () => {
    const result = await loadPromptCatalog(
      {
        version: 1,
        prompts: [
          { id: "disabled", start: "A", target: "B", enabled: false },
        ],
      },
      repositoryWith({
        A: { pageId: 1, title: "Article A" },
        B: { pageId: 2, title: "Article B" },
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{
        code: "no-enabled-prompts",
        path: "$.prompts",
        message: expect.stringContaining("at least one enabled Prompt"),
      }],
    });
  });
});
