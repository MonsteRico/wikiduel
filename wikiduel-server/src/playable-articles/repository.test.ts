import { describe, expect, test } from "vitest";

import { WikipediaGatewayError, type WikipediaPageSnapshot } from "./gateway.js";
import { createPlayableArticleRepository } from "./repository.js";

const baseSnapshot: WikipediaPageSnapshot = {
  pageId: 974,
  namespace: 0,
  title: "Ada Lovelace",
  revisionId: 12345,
  revisionTimestamp: "2026-07-01T12:34:56Z",
  html: "<p>A <strong>mathematician</strong> and writer.</p>",
  disambiguation: false,
};

function repositoryFor(value: WikipediaPageSnapshot | Error) {
  return createPlayableArticleRepository({
    fetchPage: async () => {
      if (value instanceof Error) throw value;
      return value;
    },
  });
}

describe("PlayableArticleRepository", () => {
  test("is the application boundary for a canonically identified immutable Playable Article", async () => {
    const result = await repositoryFor(baseSnapshot).getByTitle("Augusta Ada King");

    expect(result).toEqual({
      ok: true,
      article: {
        identity: { pageId: 974, title: "Ada Lovelace" },
        revision: { id: 12345, timestamp: "2026-07-01T12:34:56Z" },
        attribution: {
          sourceUrl: "https://en.wikipedia.org/wiki/Ada_Lovelace?oldid=12345",
          historyUrl: "https://en.wikipedia.org/w/index.php?title=Ada_Lovelace&action=history",
          licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
          modificationNotice: "Wiki Duel simplified and modified this Wikipedia article.",
        },
        document: {
          title: "Ada Lovelace",
          blocks: [{
            type: "paragraph",
            children: [
              { type: "text", value: "A " },
              { type: "strong", children: [{ type: "text", value: "mathematician" }] },
              { type: "text", value: " and writer." },
            ],
          }],
        },
      },
    });
    if (result.ok) {
      expect(Object.isFrozen(result.article)).toBe(true);
      expect(Object.isFrozen(result.article.document.blocks)).toBe(true);
    }
  });

  test.each([
    ["", { code: "invalid-title" }, {}],
    ["Talk:Ada Lovelace", { code: "article-not-playable", reason: "non-main-namespace" }, { namespace: 1 }],
    ["Mercury", { code: "article-not-playable", reason: "disambiguation" }, { title: "Mercury", disambiguation: true }],
    ["List of mathematicians", { code: "article-not-playable", reason: "list" }, { title: "List of mathematicians" }],
    ["2026", { code: "article-not-playable", reason: "calendar-year" }, { title: "2026" }],
    ["July 4", { code: "article-not-playable", reason: "calendar-date" }, { title: "July 4" }],
  ] as const)("maps %s to a stable public classification", async (_requested, failure, changes) => {
    const repository = repositoryFor({ ...baseSnapshot, ...changes });
    await expect(repository.getByTitle(_requested)).resolves.toEqual({ ok: false, failure });
  });

  test("maps normalization and attribution failures to stable public codes", async () => {
    const normalization = repositoryFor({ ...baseSnapshot, html: "<script>bad()</script>" });
    await expect(normalization.getByTitle("Ada Lovelace")).resolves.toEqual({
      ok: false,
      failure: { code: "article-normalization-failed" },
    });

    const attribution = repositoryFor({ ...baseSnapshot, revisionTimestamp: "" });
    await expect(attribution.getByTitle("Ada Lovelace")).resolves.toEqual({
      ok: false,
      failure: { code: "article-attribution-incomplete" },
    });
  });

  test.each([
    [new WikipediaGatewayError("not-found"), { code: "article-not-found" }],
    [new WikipediaGatewayError("rate-limited", 30), { code: "upstream-rate-limited", retryAfterSeconds: 30 }],
    [new WikipediaGatewayError("unavailable"), { code: "upstream-unavailable" }],
    [new WikipediaGatewayError("invalid-response"), { code: "upstream-unavailable" }],
  ] as const)("keeps gateway failures private", async (error, failure) => {
    await expect(repositoryFor(error).getByTitle("Ada Lovelace")).resolves.toEqual({ ok: false, failure });
  });
});
