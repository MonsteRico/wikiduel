import { describe, expect, test, vi } from "vitest";

const packageRuntime = vi.hoisted(() => ({
  setUserAgent: vi.fn(),
  page: vi.fn(),
}));

vi.mock("wikipedia", () => ({ default: { default: packageRuntime } }));

import { createWikipediaGateway } from "./gateway.js";

describe("WikipediaGateway", () => {
  test("adapts the installed package's ESM shape and native page fields", async () => {
    const html = vi.fn().mockResolvedValue("<p>Package HTML</p>");
    packageRuntime.page.mockResolvedValue({ pageid: 974, ns: 0, title: "Ada Lovelace", html });
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: { pages: { "974": {
        pageid: 974,
        ns: 0,
        title: "Ada Lovelace",
        revisions: [{ revid: 12345, timestamp: "2026-07-01T12:34:56Z" }],
      } } },
    }), { status: 200 }));

    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      request,
    });
    const snapshot = await gateway.fetchPage("Ada Lovelace");

    expect(snapshot.pageId).toBe(974);
    expect(packageRuntime.page).toHaveBeenCalledWith("Ada Lovelace", { redirect: true });
    expect(html).toHaveBeenCalledWith({ redirect: true });
    expect(packageRuntime.setUserAgent).toHaveBeenCalledWith("WikiDuel/0.1 (contact@example.com)");
  });

  test("maps the package's missing-page error into a stable gateway failure", async () => {
    const packageClient = {
      setUserAgent: vi.fn(),
      page: vi.fn().mockRejectedValue(new Error("pageError: No page with given title exists : Missing")),
    };
    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (contact@example.com)",
      packageClient,
      request: vi.fn(),
    });

    await expect(gateway.fetchPage("Missing")).rejects.toMatchObject({ kind: "not-found" });
  });

  test("uses the package first, follows redirects, and translates metadata into its own snapshot", async () => {
    const html = "<p>Ada wrote about the Analytical Engine.</p>";
    const packageClient = {
      setUserAgent: vi.fn(),
      page: vi.fn().mockResolvedValue({
        pageId: 974,
        namespace: 0,
        title: "Ada Lovelace",
        html: async () => html,
      }),
    };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: {
        pages: {
          "974": {
            pageid: 974,
            ns: 0,
            title: "Ada Lovelace",
            revisions: [{ revid: 12345, timestamp: "2026-07-01T12:34:56Z" }],
          },
        },
      },
    }), { status: 200 }));

    const gateway = createWikipediaGateway({
      userAgent: "WikiDuel/0.1 (https://example.com/contact)",
      packageClient,
      request,
    });

    await expect(gateway.fetchPage("Augusta Ada King")).resolves.toEqual({
      pageId: 974,
      namespace: 0,
      title: "Ada Lovelace",
      revisionId: 12345,
      revisionTimestamp: "2026-07-01T12:34:56Z",
      html,
      disambiguation: false,
    });
    expect(packageClient.setUserAgent).toHaveBeenCalledWith("WikiDuel/0.1 (https://example.com/contact)");
    expect(packageClient.page).toHaveBeenCalledWith("Augusta Ada King", { redirect: true });
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://en.wikipedia.org/w/api.php");
    expect(url.searchParams.get("pageids")).toBe("974");
    expect(options.headers).toEqual({
      "Api-User-Agent": "WikiDuel/0.1 (https://example.com/contact)",
      "User-Agent": "WikiDuel/0.1 (https://example.com/contact)",
    });
  });

  test("recognizes disambiguation metadata without exposing the raw response", async () => {
    const packageClient = {
      setUserAgent: vi.fn(),
      page: vi.fn().mockResolvedValue({
        pageId: 12,
        namespace: 0,
        title: "Mercury",
        html: async () => "<p>Topics called Mercury</p>",
      }),
    };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: { pages: { "12": {
        pageid: 12,
        ns: 0,
        title: "Mercury",
        pageprops: { disambiguation: "" },
        revisions: [{ revid: 99, timestamp: "2026-01-01T00:00:00Z" }],
      } } },
    }), { status: 200 }));

    const gateway = createWikipediaGateway({ userAgent: "WikiDuel/0.1 (contact@example.com)", packageClient, request });
    const snapshot = await gateway.fetchPage("Mercury");
    expect(snapshot.disambiguation).toBe(true);
    expect(snapshot).not.toHaveProperty("query");
    expect(snapshot).not.toHaveProperty("pageprops");
  });
});
