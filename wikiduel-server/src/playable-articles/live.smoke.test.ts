import { describe, expect, test } from "vitest";

import { createLivePlayableArticleRepository } from "./index.js";

const live = process.env.WIKIMEDIA_LIVE_SMOKE === "1" && process.env.WIKIMEDIA_USER_AGENT
  ? describe
  : describe.skip;

live("live English Wikipedia smoke", () => {
  test("loads an ordinary article with revision attribution", async () => {
    const repository = createLivePlayableArticleRepository(process.env);
    const result = await repository.getByTitle("Ada Lovelace");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.article.identity.pageId).toBeGreaterThan(0);
      expect(result.article.revision.id).toBeGreaterThan(0);
      expect(result.article.document.blocks.length).toBeGreaterThan(0);
    }
  }, 20_000);

  test("resolves a redirect to canonical identity", async () => {
    const repository = createLivePlayableArticleRepository(process.env);
    const result = await repository.getByTitle("USA");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.article.identity.title).toBe("United States");
  }, 20_000);

  test("classifies a disambiguation page", async () => {
    const repository = createLivePlayableArticleRepository(process.env);
    await expect(repository.getByTitle("Mercury")).resolves.toEqual({
      ok: false,
      failure: { code: "article-not-playable", reason: "disambiguation" },
    });
  }, 20_000);
});
