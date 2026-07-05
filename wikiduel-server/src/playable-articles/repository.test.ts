import { describe, expect, test, vi } from "vitest";

import {
  WikipediaGatewayError,
  type WikipediaPageSnapshot,
  type WikipediaResolvedLink,
} from "./gateway.js";
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

function repositoryFor(
  value: WikipediaPageSnapshot | Error,
  resolvedLinks: readonly WikipediaResolvedLink[] = [],
) {
  return createPlayableArticleRepository({
    fetchPage: async () => {
      if (value instanceof Error) throw value;
      return value;
    },
    resolveLinks: async () => resolvedLinks,
  });
}

describe("PlayableArticleRepository", () => {
  test("emits a canonical Navigation Node for an eligible internal link", async () => {
    const repository = repositoryFor(
      {
        ...baseSnapshot,
        html: '<p>She described the <a href="/wiki/Analytical_engine"><strong>engine</strong></a>.</p>',
      },
      [{
        requestedTitle: "Analytical engine",
        exists: true,
        pageId: 1361267,
        namespace: 0,
        title: "Analytical Engine",
        disambiguation: false,
      }],
    );

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({
      ok: true,
      article: {
        document: {
          blocks: [{
            type: "paragraph",
            children: [
              { type: "text", value: "She described the " },
              {
                type: "navigation",
                destination: { pageId: 1361267, title: "Analytical Engine" },
                children: [{ type: "strong", children: [{ type: "text", value: "engine" }] }],
              },
              { type: "text", value: "." },
            ],
          }],
        },
      },
    });
    if (result.ok) {
      expect(result.article.document.blocks[0]).not.toHaveProperty("url");
      expect(JSON.stringify(result.article.document)).not.toContain("/wiki/Analytical_engine");
    }
  });

  test.each([
    ["missing pages", { requestedTitle: "Missing", exists: false }],
    ["non-main namespaces", {
      requestedTitle: "Talk:Ada Lovelace", exists: true, pageId: 2, namespace: 1,
      title: "Talk:Ada Lovelace", disambiguation: false,
    }],
    ["disambiguation pages", {
      requestedTitle: "Mercury", exists: true, pageId: 3, namespace: 0,
      title: "Mercury", disambiguation: true,
    }],
    ["list articles", {
      requestedTitle: "List of mathematicians", exists: true, pageId: 4, namespace: 0,
      title: "List of mathematicians", disambiguation: false,
    }],
    ["lists articles", {
      requestedTitle: "Lists of mathematics topics", exists: true, pageId: 5, namespace: 0,
      title: "Lists of mathematics topics", disambiguation: false,
    }],
    ["calendar years", {
      requestedTitle: "2026", exists: true, pageId: 6, namespace: 0,
      title: "2026", disambiguation: false,
    }],
    ["BC calendar years", {
      requestedTitle: "44 BC", exists: true, pageId: 7, namespace: 0,
      title: "44 BC", disambiguation: false,
    }],
    ["calendar dates", {
      requestedTitle: "July 4", exists: true, pageId: 8, namespace: 0,
      title: "July 4", disambiguation: false,
    }],
  ] as const)("keeps labels readable when resolved metadata identifies %s", async (_kind, link) => {
    const repository = repositoryFor({
      ...baseSnapshot,
      html: `<p>Read <a href="/wiki/${encodeURIComponent(link.requestedTitle)}">this label</a>.</p>`,
    }, [link]);

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({
      ok: true,
      article: {
        document: {
          blocks: [{
            type: "paragraph",
            children: [
              { type: "text", value: "Read this label." },
            ],
          }],
        },
      },
    });
  });

  test("resolves only eligible article anchors and keeps unsupported or malformed links readable", async () => {
    const resolveLinks = vi.fn().mockResolvedValue([]);
    const repository = createPlayableArticleRepository({
      fetchPage: async () => ({
        ...baseSnapshot,
        html: `<p>
          <a href="https://example.com">external</a> |
          <a href="/wiki/Ada_Lovelace?action=edit">edit</a> |
          <a href="/wiki/Help:Contents">help</a> |
          <a href="/wiki/File:Ada.jpg">file</a> |
          <a href="/wiki/Category:Mathematicians">category</a> |
          <a href="/wiki/Talk:Ada_Lovelace">talk</a> |
          <a href="/wiki/Special:Search">special</a> |
          <a href="/w/index.php?search=engine">search</a> |
          <a class="new" href="/wiki/Missing?redlink=1">red</a> |
          <a href="#cite_note-1">citation</a> |
          <a href="#Biography">in-page</a> |
          <a href="/wiki/%E0%A4%A">malformed</a> |
          <a href="/wiki/Bad%7CTitle">invalid title</a> |
          <a href="/wiki/Ordinary_article">ordinary</a>
        </p>`,
      }),
      resolveLinks,
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(resolveLinks).toHaveBeenCalledWith(["Ordinary article"]);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      const serialized = JSON.stringify(result.article.document);
      expect(serialized).toContain("external");
      expect(serialized).toContain("malformed");
      expect(serialized).toContain("invalid title");
      expect(serialized).toContain("ordinary");
      expect(serialized).not.toContain('"type":"navigation"');
    }
  });

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
