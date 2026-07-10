import { describe, expect, test } from "vitest";

import { createLivePlayableArticleRepository } from "./index.js";

const liveEnabled = process.env.WIKIMEDIA_LIVE_SMOKE === "1" && Boolean(process.env.WIKIMEDIA_USER_AGENT);
const live = liveEnabled ? describe : describe.skip;
const reportedStrangeTitle = process.env.WIKIMEDIA_LIVE_SMOKE_REPORTED_TITLE?.trim();
const reportedStrange = liveEnabled && reportedStrangeTitle ? describe : describe.skip;

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

  test("loads safe attributed figures from live Wikimedia metadata", async () => {
    const repository = createLivePlayableArticleRepository(process.env);
    const result = await repository.getByTitle("Cat");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const figure = result.article.document.blocks.find((block) => block.type === "figure");
      expect(figure).toBeDefined();
      if (figure) {
        expect(figure.sourceUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\//);
        expect(figure.width).toBeGreaterThan(1);
        expect(figure.height).toBeGreaterThan(1);
        expect(figure.alt.trim().length + figure.caption.length).toBeGreaterThan(0);
        expect(figure.attribution.descriptionUrl).toMatch(
          /^https:\/\/(?:commons\.wikimedia|en\.wikipedia)\.org\/wiki\/File:/,
        );
        expect(figure.attribution.historyUrl).toContain("action=history");
        expect(figure.attribution.licenseName.trim()).not.toBe("");
        expect(figure.attribution.licenseUrl).toMatch(/^https:\/\//);
      }
    }
  }, 30_000);

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

reportedStrange("reported-strange live article", () => {
  test("returns a typed result that can be inspected in the Lab", async () => {
    const repository = createLivePlayableArticleRepository(process.env);
    const result = await repository.getByTitle(reportedStrangeTitle!);
    expect(result.ok || result.failure.code).toBeTruthy();
  }, 30_000);
});
