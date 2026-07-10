import { describe, expect, test, vi } from "vitest";

import {
  WikipediaGatewayError,
  type WikipediaGateway,
  type WikipediaImageMetadata,
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

const safeImageMetadata: WikipediaImageMetadata = {
  requestedTitle: "File:Ada portrait.jpg",
  sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada.jpg/320px-Ada.jpg",
  width: 320,
  height: 400,
  mimeType: "image/jpeg",
  descriptionUrl: "https://commons.wikimedia.org/wiki/File:Ada_portrait.jpg",
  creatorHtml: "<b>Margaret Sarah Carpenter &#x26; studio</b><script>ignored()</script>",
  creditHtml: "National Portrait Gallery",
  licenseName: "Public domain",
  licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
  nonFree: false,
  restrictions: [],
};

function gatewayWith(overrides: Partial<WikipediaGateway> = {}): WikipediaGateway {
  return {
    fetchPage: async () => baseSnapshot,
    resolveLinks: async () => [],
    fetchImageMetadata: async () => [],
    ...overrides,
  };
}

function repositoryFor(
  value: WikipediaPageSnapshot | Error,
  resolvedLinks: readonly WikipediaResolvedLink[] = [],
) {
  return createPlayableArticleRepository(gatewayWith({
    fetchPage: async () => {
      if (value instanceof Error) throw value;
      return value;
    },
    resolveLinks: async () => resolvedLinks,
  }));
}

describe("PlayableArticleRepository", () => {
  test("reuses a complete article for repeated normalized-title requests", async () => {
    const fetchPage = vi.fn().mockResolvedValue(baseSnapshot);
    const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

    const first = await repository.getByTitle("  Ada_Lovelace  ");
    const second = await repository.getByTitle("Ada Lovelace");

    expect(first).toMatchObject({ ok: true, article: { identity: { pageId: 974 } } });
    expect(second).toEqual(first);
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage.mock.calls[0]?.[0]).toBe("Ada Lovelace");
  });

  test("maps distinct redirect aliases to one cached canonical page ID", async () => {
    const fetchPage = vi.fn().mockResolvedValue(baseSnapshot);
    const resolveLinks = vi.fn().mockResolvedValue([]);
    const repository = createPlayableArticleRepository(gatewayWith({
      fetchPage,
      resolveLinks,
    }));

    const first = await repository.getByTitle("Augusta Ada King");
    const second = await repository.getByTitle("Countess of Lovelace");
    const repeatedAlias = await repository.getByTitle("Countess_of_Lovelace");

    expect(first).toMatchObject({ ok: true, article: { identity: { pageId: 974 } } });
    expect(second).toEqual(first);
    expect(repeatedAlias).toEqual(first);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(resolveLinks).toHaveBeenCalledOnce();
  });

  test("coalesces concurrent work for the same normalized title", async () => {
    let completeFetch!: (snapshot: WikipediaPageSnapshot) => void;
    const fetchPage = vi.fn().mockReturnValue(new Promise<WikipediaPageSnapshot>((resolve) => {
      completeFetch = resolve;
    }));
    const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

    const first = repository.getByTitle("Ada_Lovelace");
    const second = repository.getByTitle("  Ada Lovelace  ");

    expect(fetchPage).toHaveBeenCalledOnce();
    completeFetch(baseSnapshot);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).toBe(firstResult);
  });

  test("ends a build at the 15-second budget and never caches its late completion", async () => {
    vi.useFakeTimers();
    try {
      let completeLateFetch!: (snapshot: WikipediaPageSnapshot) => void;
      let buildSignal: AbortSignal | undefined;
      const fetchPage = vi.fn()
        .mockImplementationOnce((_title: string, options?: { signal?: AbortSignal }) => new Promise<WikipediaPageSnapshot>((resolve) => {
          buildSignal = options?.signal;
          completeLateFetch = resolve;
        }))
        .mockResolvedValue(baseSnapshot);
      const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

      const timedOut = repository.getByTitle("Ada Lovelace");
      await vi.advanceTimersByTimeAsync(15_000);
      await expect(timedOut).resolves.toEqual({
        ok: false,
        failure: { code: "upstream-unavailable" },
      });
      expect(buildSignal?.aborted).toBe(true);

      completeLateFetch(baseSnapshot);
      await vi.runAllTimersAsync();
      await expect(repository.getByTitle("Ada Lovelace")).resolves.toMatchObject({ ok: true });
      expect(fetchPage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  }, 1_000);

  test("retries one transient upstream failure after short jitter within the build budget", async () => {
    vi.useFakeTimers();
    try {
      const fetchPage = vi.fn()
        .mockRejectedValueOnce(new WikipediaGatewayError("transient"))
        .mockResolvedValue(baseSnapshot);
      const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

      const result = repository.getByTitle("Ada Lovelace");
      await Promise.resolve();
      expect(fetchPage).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(result).resolves.toMatchObject({ ok: true });
      expect(fetchPage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps cache and retry details debug-only and warns once for a final failed build", async () => {
    vi.useFakeTimers();
    try {
      const fetchPage = vi.fn()
        .mockRejectedValueOnce(new WikipediaGatewayError("transient"))
        .mockRejectedValueOnce(new WikipediaGatewayError("transient"))
        .mockResolvedValue(baseSnapshot);
      const logger = { debug: vi.fn(), warn: vi.fn() };
      const repository = createPlayableArticleRepository(
        gatewayWith({ fetchPage }),
        { logger, random: () => 0 },
      );

      const failed = repository.getByTitle("Ada Lovelace");
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(failed).resolves.toEqual({
        ok: false,
        failure: { code: "upstream-unavailable" },
      });
      await expect(repository.getByTitle("Ada Lovelace")).resolves.toMatchObject({ ok: true });
      await expect(repository.getByTitle("Ada_Lovelace")).resolves.toMatchObject({ ok: true });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ requestedTitle: "Ada Lovelace", event: "retry" }),
        expect.any(String),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { requestedTitle: "Ada Lovelace", event: "cache-hit" },
        expect.any(String),
      );
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        { requestedTitle: "Ada Lovelace", failureCode: "upstream-unavailable" },
        expect.any(String),
      );
      expect(fetchPage).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  test("returns image-enrichment rate limits instead of caching a partial article", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      ...baseSnapshot,
      html: `<p>Article text.</p><figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Ada_portrait.jpg"><img alt="Ada Lovelace"></a>
      </figure>`,
    });
    const fetchImageMetadata = vi.fn().mockRejectedValue(
      new WikipediaGatewayError("rate-limited", 31),
    );
    const resolveLinks = vi.fn().mockResolvedValue([]);
    const repository = createPlayableArticleRepository(gatewayWith({
      fetchPage,
      resolveLinks,
      fetchImageMetadata,
    }));

    const expected = {
      ok: false,
      failure: { code: "upstream-rate-limited", retryAfterSeconds: 31 },
    } as const;
    await expect(repository.getByTitle("Ada Lovelace")).resolves.toEqual(expected);
    await expect(repository.getByTitle("Ada Lovelace")).resolves.toEqual(expected);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchImageMetadata).toHaveBeenCalledTimes(2);
    expect(resolveLinks).not.toHaveBeenCalled();
  });

  test.each([
    ["missing page", new WikipediaGatewayError("not-found")],
    ["non-playable page", { ...baseSnapshot, disambiguation: true }],
    ["normalization failure", { ...baseSnapshot, html: "<script>bad()</script>" }],
  ] as const)("does not cache a %s result", async (_case, outcome) => {
    const fetchPage = vi.fn().mockImplementation(async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    });
    const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

    const first = await repository.getByTitle("Ada Lovelace");
    const second = await repository.getByTitle("Ada Lovelace");

    expect(first).toMatchObject({ ok: false });
    expect(second).toEqual(first);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  test.each([
    [
      new WikipediaGatewayError("rate-limited", 23),
      { code: "upstream-rate-limited", retryAfterSeconds: 23 },
    ],
    [new WikipediaGatewayError("back-pressure"), { code: "upstream-unavailable" }],
    [new WikipediaGatewayError("unavailable"), { code: "upstream-unavailable" }],
    [new WikipediaGatewayError("invalid-response"), { code: "upstream-unavailable" }],
  ] as const)("does not automatically retry %s", async (error, failure) => {
    const fetchPage = vi.fn().mockRejectedValue(error);
    const repository = createPlayableArticleRepository(gatewayWith({ fetchPage }));

    await expect(repository.getByTitle("Ada Lovelace")).resolves.toEqual({ ok: false, failure });
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  test("keeps completed caches local to each repository process instance", async () => {
    const fetchPage = vi.fn().mockResolvedValue(baseSnapshot);
    const gateway = gatewayWith({ fetchPage });
    const firstProcessRepository = createPlayableArticleRepository(gateway);
    const restartedProcessRepository = createPlayableArticleRepository(gateway);

    await firstProcessRepository.getByTitle("Ada Lovelace");
    await firstProcessRepository.getByTitle("Ada Lovelace");
    await restartedProcessRepository.getByTitle("Ada Lovelace");

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  test("preserves a safe attributed article-body figure at its source position", async () => {
    const repository = createPlayableArticleRepository({
      fetchPage: async () => ({
        ...baseSnapshot,
        html: `
          <p>Before the portrait.</p>
          <figure typeof="mw:File/Thumb">
            <a href="/wiki/File:Ada_portrait.jpg" class="mw-file-description">
              <img alt="Portrait of Ada Lovelace" width="320" height="400"
                src="//upload.wikimedia.org/untrusted-source.jpg">
            </a>
            <figcaption>Ada Lovelace in 1840</figcaption>
          </figure>
          <p>After the portrait.</p>
        `,
      }),
      resolveLinks: async () => [],
      fetchImageMetadata: async () => [safeImageMetadata],
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({
      ok: true,
      article: {
        document: {
          blocks: [
            { type: "paragraph", children: [{ type: "text", value: "Before the portrait." }] },
            {
              type: "figure",
              sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada.jpg/320px-Ada.jpg",
              width: 320,
              height: 400,
              alt: "Portrait of Ada Lovelace",
              caption: [{ type: "text", value: "Ada Lovelace in 1840" }],
              attribution: {
                descriptionUrl: "https://commons.wikimedia.org/wiki/File:Ada_portrait.jpg",
                historyUrl: "https://commons.wikimedia.org/w/index.php?title=File%3AAda_portrait.jpg&action=history",
                creator: "Margaret Sarah Carpenter & studio",
                credit: "National Portrait Gallery",
                licenseName: "Public domain",
                licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
              },
            },
            { type: "paragraph", children: [{ type: "text", value: "After the portrait." }] },
          ],
        },
      },
    });
  });

  test("uses the prose classifier for Navigation Nodes inside figure captions", async () => {
    const repository = createPlayableArticleRepository({
      fetchPage: async () => ({
        ...baseSnapshot,
        html: `<p>Article text.</p><figure typeof="mw:File/Thumb">
          <a href="/wiki/File:Ada_portrait.jpg"><img alt="Ada Lovelace"></a>
          <figcaption>Portrait of <a href="/wiki/Ada_Lovelace"><em>Ada</em></a></figcaption>
        </figure>`,
      }),
      resolveLinks: async () => [{
        requestedTitle: "Ada Lovelace",
        exists: true,
        pageId: 974,
        namespace: 0,
        title: "Ada Lovelace",
        disambiguation: false,
      }],
      fetchImageMetadata: async () => [safeImageMetadata],
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({
      ok: true,
      article: { document: { blocks: [
        { type: "paragraph" },
        { type: "figure", caption: [
          { type: "text", value: "Portrait of " },
          {
            type: "navigation",
            destination: { pageId: 974, title: "Ada Lovelace" },
            children: [{ type: "emphasis", children: [{ type: "text", value: "Ada" }] }],
          },
        ] },
      ] } },
    });
  });

  test.each([
    ["HTTP source", { sourceUrl: "http://upload.wikimedia.org/image.jpg" }],
    ["protocol-relative source", { sourceUrl: "//upload.wikimedia.org/image.jpg" }],
    ["credentialed source", { sourceUrl: "https://name:secret@upload.wikimedia.org/image.jpg" }],
    ["unapproved source origin", { sourceUrl: "https://images.example/image.jpg" }],
    ["redirect-shaped source path", {
      sourceUrl: "https://upload.wikimedia.org/redirect?to=https://images.example/image.jpg",
    }],
    ["unapproved description origin", { descriptionUrl: "https://example.com/wiki/File:Ada_portrait.jpg" }],
    ["HTTP license", { licenseUrl: "http://creativecommons.org/licenses/by/4.0/" }],
    ["unsupported SVG MIME type", { mimeType: "image/svg+xml" }],
    ["non-free status", { nonFree: true }],
    ["fair-use restriction", { restrictions: ["fair-use"] }],
    ["one-pixel tracking dimensions", { width: 1, height: 1 }],
    ["missing license URL", { licenseUrl: undefined }],
  ] as const)("omits media with %s without rejecting the article", async (_case, changes) => {
    const repository = createPlayableArticleRepository({
      fetchPage: async () => ({
        ...baseSnapshot,
        html: `<p>Article remains readable.</p><figure typeof="mw:File/Thumb">
          <a href="/wiki/File:Ada_portrait.jpg"><img alt="Ada Lovelace"></a>
        </figure>`,
      }),
      resolveLinks: async () => [],
      fetchImageMetadata: async () => [{ ...safeImageMetadata, ...changes }],
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.article.document.blocks).toHaveLength(1);
  });

  test("omits a figure whose description URL is not an approved file page", async () => {
    const repository = createPlayableArticleRepository({
      fetchPage: async () => ({
        ...baseSnapshot,
        html: `<p>Article remains readable.</p><figure typeof="mw:File/Thumb">
          <a href="/wiki/File:Forged.jpg"><img alt="Forged image"></a>
        </figure>`,
      }),
      resolveLinks: async () => [],
      fetchImageMetadata: async () => [{
        requestedTitle: "File:Forged.jpg",
        sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/f/forged.jpg",
        width: 100,
        height: 100,
        mimeType: "image/jpeg",
        descriptionUrl: "https://commons.wikimedia.org/w/index.php?title=File:Forged.jpg&redirect=https://evil.example",
        licenseName: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        nonFree: false,
        restrictions: [],
      }],
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(result).toMatchObject({
      ok: true,
      article: { document: { blocks: [{ type: "paragraph" }] } },
    });
    if (result.ok) expect(result.article.document.blocks).toHaveLength(1);
  });

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
      const paragraph = result.article.document.blocks[0];
      expect(paragraph).toMatchObject({ type: "paragraph" });
      if (paragraph?.type === "paragraph") {
        expect(paragraph.children[1]).toMatchObject({ type: "navigation" });
        expect(paragraph.children[1]).not.toHaveProperty("url");
        expect(paragraph.children[1]).not.toHaveProperty("href");
      }
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
      fetchImageMetadata: async () => [],
    });

    const result = await repository.getByTitle("Ada Lovelace");

    expect(resolveLinks.mock.calls[0]?.[0]).toEqual(["Ordinary article"]);
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
