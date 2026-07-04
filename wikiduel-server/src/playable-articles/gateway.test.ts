import { describe, expect, test, vi } from "vitest";

// Vitest hoists this fake before gateway.ts imports the wikipedia package. These
// are the two package methods the gateway actually uses; no second client
// abstraction is involved.
const wikipediaPackage = vi.hoisted(() => ({
  setUserAgent: vi.fn(),
  page: vi.fn(),
}));

// The nested default matches the package's CommonJS/ESM export shape under Node.
vi.mock("wikipedia", () => ({ default: { default: wikipediaPackage } }));

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
