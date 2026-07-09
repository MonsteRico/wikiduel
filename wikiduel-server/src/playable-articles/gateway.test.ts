import { beforeEach, describe, expect, test, vi } from "vitest";

// Vitest hoists this fake before gateway.ts imports the wikipedia package. These
// are the two package methods the gateway actually uses; no second client
// abstraction is involved.
const wikipediaPackage = vi.hoisted(() => ({
  setUserAgent: vi.fn(),
  page: vi.fn(),
}));

// Vite unwraps the package's CommonJS/ESM bridge to this direct client shape.
vi.mock("wikipedia", () => ({ default: wikipediaPackage }));

import { createWikipediaGateway } from "./gateway.js";

function metadataResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    query: {
      pages: {
        "974": {
          pageid: 974,
          ns: 0,
          title: "Ada Lovelace",
          revisions: [{ revid: 12345, timestamp: "2026-07-01T12:34:56Z" }],
          ...overrides,
        },
      },
    },
  }), { status: 200 });
}

describe("WikipediaGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("fetches complete image attribution for structural figure candidates", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      batchcomplete: true,
      query: {
        pages: [{
          ns: 6,
          title: "File:Ada portrait.jpg",
          imagerepository: "shared",
          imageinfo: [{
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada.jpg/800px-Ada.jpg",
            thumbwidth: 800,
            thumbheight: 1000,
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Ada_portrait.jpg",
            mime: "image/jpeg",
            mediatype: "BITMAP",
            extmetadata: {
              Artist: { value: "<b>Margaret Sarah Carpenter</b>" },
              Credit: { value: "National Portrait Gallery" },
              LicenseShortName: { value: "Public domain" },
              LicenseUrl: { value: "https://creativecommons.org/publicdomain/mark/1.0/" },
              NonFree: { value: "False" },
              Restrictions: { value: "" },
            },
          }],
        }],
      },
    }), { status: 200 }));
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    await expect(gateway.fetchImageMetadata?.(["File:Ada portrait.jpg"])).resolves.toEqual([{
      requestedTitle: "File:Ada portrait.jpg",
      sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada.jpg/800px-Ada.jpg",
      width: 800,
      height: 1000,
      mimeType: "image/jpeg",
      descriptionUrl: "https://commons.wikimedia.org/wiki/File:Ada_portrait.jpg",
      creatorHtml: "<b>Margaret Sarah Carpenter</b>",
      creditHtml: "National Portrait Gallery",
      licenseName: "Public domain",
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      nonFree: false,
      restrictions: [],
    }]);

    const [url, options] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("titles")).toBe("File:Ada portrait.jpg");
    expect(url.searchParams.get("prop")).toBe("imageinfo");
    expect(url.searchParams.get("iiprop")).toContain("extmetadata");
    expect(url.searchParams.get("iiurlwidth")).toBe("800");
    expect(options.headers).toEqual({
      "Api-User-Agent": "WikiDuel/0.1 (contact@example.com)",
      "User-Agent": "WikiDuel/0.1 (contact@example.com)",
    });
  });

  test("translates booleanish non-free metadata conservatively", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: { pages: [{
        title: "File:Non-free.jpg",
        imageinfo: [{
          thumburl: "https://upload.wikimedia.org/non-free.jpg",
          thumbwidth: 200,
          thumbheight: 100,
          descriptionurl: "https://en.wikipedia.org/wiki/File:Non-free.jpg",
          mime: "image/jpeg",
          extmetadata: {
            LicenseShortName: { value: "Fair use" },
            LicenseUrl: { value: "https://en.wikipedia.org/wiki/Wikipedia:Non-free_content" },
            NonFree: { value: "1" },
            Restrictions: { value: "fair-use|trademarked" },
          },
        }],
      }] },
    }), { status: 200 }));
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    const [image] = await gateway.fetchImageMetadata(["File:Non-free.jpg"]);

    expect(image).toMatchObject({
      nonFree: true,
      restrictions: ["fair-use", "trademarked"],
    });
  });

  test("batches image attribution requests within the scaled-image limit", async () => {
    const titles = Array.from({ length: 51 }, (_, index) => `File:Image ${index + 1}.jpg`);
    const request = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const batchTitles = url.searchParams.get("titles")?.split("|") ?? [];
      return new Response(JSON.stringify({
        query: { pages: batchTitles.map((title) => ({
          title,
          imageinfo: [{
            thumburl: `https://upload.wikimedia.org/wikipedia/commons/${encodeURIComponent(title)}.jpg`,
            thumbwidth: 800,
            thumbheight: 600,
            descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
            mime: "image/jpeg",
            extmetadata: {},
          }],
        })) },
      }), { status: 200 });
    });
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    const result = await gateway.fetchImageMetadata(titles);

    expect(result).toHaveLength(51);
    expect(request).toHaveBeenCalledTimes(2);
    const firstUrl = request.mock.calls[0]?.[0] as URL;
    const secondUrl = request.mock.calls[1]?.[0] as URL;
    expect(firstUrl.searchParams.get("titles")?.split("|")).toHaveLength(50);
    expect(secondUrl.searchParams.get("titles")).toBe("File:Image 51.jpg");
  });

  test("bulk-resolves redirect aliases to canonical link metadata without fetching bodies", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      batchcomplete: true,
      query: {
        redirects: [{ from: "Analytical engine", to: "Analytical Engine" }],
        pages: [{
          pageid: 1361267,
          ns: 0,
          title: "Analytical Engine",
          pageprops: {},
        }],
      },
    }), { status: 200 }));
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    await expect(gateway.resolveLinks(["Analytical engine"])).resolves.toEqual([{
      requestedTitle: "Analytical engine",
      exists: true,
      pageId: 1361267,
      namespace: 0,
      title: "Analytical Engine",
      disambiguation: false,
    }]);

    const [url] = request.mock.calls[0] as [URL];
    expect(url.searchParams.get("titles")).toBe("Analytical engine");
    expect(url.searchParams.get("redirects")).toBe("1");
    expect(url.searchParams.get("prop")).toBe("pageprops");
    expect(url.searchParams.has("rvprop")).toBe(false);
    expect(wikipediaPackage.page).not.toHaveBeenCalled();
  });

  test("batches large candidate sets within the official query title limit", async () => {
    const titles = Array.from({ length: 51 }, (_, index) => `Article ${index + 1}`);
    const request = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const batchTitles = url.searchParams.get("titles")?.split("|") ?? [];
      return new Response(JSON.stringify({
        batchcomplete: true,
        query: {
          pages: batchTitles.map((title, index) => ({
            pageid: Number(title.slice("Article ".length)) + index + 100,
            ns: 0,
            title,
            pageprops: {},
          })),
        },
      }), { status: 200 });
    });
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    const result = await gateway.resolveLinks(titles);

    expect(result).toHaveLength(51);
    expect(request).toHaveBeenCalledTimes(2);
    const firstUrl = request.mock.calls[0]?.[0] as URL;
    const secondUrl = request.mock.calls[1]?.[0] as URL;
    expect(firstUrl.searchParams.get("titles")?.split("|")).toHaveLength(50);
    expect(secondUrl.searchParams.get("titles")).toBe("Article 51");
  });

  test("uses the canonical page returned by the package for a redirected request", async () => {
    const html = vi.fn().mockResolvedValue("<p>Ada wrote about the Analytical Engine.</p>");

    // The requested title is an alias. This fake models the package's redirect
    // behavior by returning the canonical Ada Lovelace identity. The opt-in live
    // smoke test separately checks a real redirect against Wikipedia.
    wikipediaPackage.page.mockResolvedValue({
      pageid: 974,
      ns: 0,
      title: "Ada Lovelace",
      html,
    });
    const request = vi.fn().mockResolvedValue(metadataResponse());
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (https://example.com/contact)",
      request,
    });

    await expect(gateway.fetchPage("Ada Byron")).resolves.toEqual({
      pageId: 974,
      namespace: 0,
      title: "Ada Lovelace",
      revisionId: 12345,
      revisionTimestamp: "2026-07-01T12:34:56Z",
      html: "<p>Ada wrote about the Analytical Engine.</p>",
      disambiguation: false,
    });

    expect(wikipediaPackage.page).toHaveBeenCalledWith("Ada Byron", { redirect: true });
    expect(html).toHaveBeenCalledWith({ redirect: true });
    expect(wikipediaPackage.setUserAgent).toHaveBeenCalledWith(
      "WikiDuel/0.1 (https://example.com/contact)",
    );

    // The package supplies identity and article HTML. The direct metadata call
    // adds the exact revision timestamp and disambiguation marker it lacks.
    const [url, options] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://en.wikipedia.org/w/api.php");
    expect(url.searchParams.get("pageids")).toBe("974");
    expect(options.headers).toEqual({
      "Api-User-Agent": "WikiDuel/0.1 (https://example.com/contact)",
      "User-Agent": "WikiDuel/0.1 (https://example.com/contact)",
    });
  });

  test("maps the package's missing-page error into a stable gateway failure", async () => {
    wikipediaPackage.page.mockRejectedValue(
      new Error("pageError: No page with given title exists : Missing"),
    );
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request: vi.fn(),
    });

    await expect(gateway.fetchPage("Missing")).rejects.toMatchObject({ kind: "not-found" });
  });

  test("recognizes disambiguation metadata without exposing the raw response", async () => {
    wikipediaPackage.page.mockResolvedValue({
      pageid: 12,
      ns: 0,
      title: "Mercury",
      html: vi.fn().mockResolvedValue("<p>Topics called Mercury</p>"),
    });
    const request = vi.fn().mockResolvedValue(metadataResponse({
      pageid: 12,
      title: "Mercury",
      pageprops: { disambiguation: "" },
      revisions: [{ revid: 99, timestamp: "2026-01-01T00:00:00Z" }],
    }));
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });

    const snapshot = await gateway.fetchPage("Mercury");

    expect(snapshot.disambiguation).toBe(true);
    // Only the project-owned snapshot crosses the gateway boundary.
    expect(snapshot).not.toHaveProperty("query");
    expect(snapshot).not.toHaveProperty("pageprops");
  });
});
