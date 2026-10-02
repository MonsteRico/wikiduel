import { expect, test, vi } from "vitest";

import { WikipediaGatewayError, type WikipediaResolvedLink } from "./gateway.js";
import { createPlayableArticleIdentityResolver } from "./repository.js";

function resolverFor(link: WikipediaResolvedLink) {
  const resolveLinks = vi.fn(async () => [link]);
  return {
    resolveLinks,
    resolver: createPlayableArticleIdentityResolver({
      resolveLinks,
      fetchPage: vi.fn(),
      fetchImageMetadata: vi.fn(),
    }),
  };
}

const canonicalLink = {
  requestedTitle: "Cow", exists: true as const, pageId: 10,
  namespace: 0, title: "Cattle", disambiguation: false,
};

test("resolves redirects and caches requested and canonical titles", async () => {
  const { resolver, resolveLinks } = resolverFor(canonicalLink);
  const result = { ok: true, article: { identity: { pageId: 10, title: "Cattle" } } };
  await expect(resolver.getByTitle("Cow")).resolves.toEqual(result);
  await expect(resolver.getByTitle("Cattle")).resolves.toEqual(result);
  expect(resolveLinks).toHaveBeenCalledTimes(1);
  expect(resolveLinks).toHaveBeenCalledWith(["Cow"], { signal: expect.any(AbortSignal) });
});

test.each([
  [{ namespace: 1 }, "non-main-namespace"],
  [{ disambiguation: true }, "disambiguation"],
  [{ title: "List of cattle breeds" }, "list"],
  [{ title: "2026" }, "calendar-year"],
  [{ title: "January 1" }, "calendar-date"],
] as const)("rejects excluded article identities %j", async (overrides, reason) => {
  const { resolver } = resolverFor({ ...canonicalLink, ...overrides });
  await expect(resolver.getByTitle("Cow")).resolves.toEqual({
    ok: false, failure: { code: "article-not-playable", reason },
  });
});

test("rejects missing articles and invalid titles", async () => {
  const { resolver, resolveLinks } = resolverFor({ requestedTitle: "Missing", exists: false });
  await expect(resolver.getByTitle("")).resolves.toEqual({ ok: false, failure: { code: "invalid-title" } });
  expect(resolveLinks).not.toHaveBeenCalled();
  await expect(resolver.getByTitle("Missing")).resolves.toEqual({ ok: false, failure: { code: "article-not-found" } });
});

test("preserves upstream failures and allows a later lookup to recover", async () => {
  const { resolver, resolveLinks } = resolverFor(canonicalLink);
  resolveLinks.mockRejectedValueOnce(new WikipediaGatewayError("rate-limited", 60));
  await expect(resolver.getByTitle("Cow")).resolves.toEqual({
    ok: false, failure: { code: "upstream-rate-limited", retryAfterSeconds: 60 },
  });
  resolveLinks.mockRejectedValueOnce(new WikipediaGatewayError("transient"));
  await expect(resolver.getByTitle("Cow")).resolves.toEqual({
    ok: false, failure: { code: "upstream-unavailable" },
  });
  await expect(resolver.getByTitle("Cow")).resolves.toMatchObject({ ok: true });
});
