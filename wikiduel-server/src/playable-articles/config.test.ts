import { describe, expect, test } from "vitest";

import { loadWikimediaConfig } from "./config.js";

describe("live Wikimedia configuration", () => {
  test("accepts an identifying application User-Agent with contact information", () => {
    expect(loadWikimediaConfig({
      WIKIMEDIA_USER_AGENT: "WikiDuel/0.1 (https://wikiduel.example/contact)",
    })).toEqual({
      userAgent: "WikiDuel/0.1 (https://wikiduel.example/contact)",
    });
  });

  test.each([
    undefined,
    "",
    "Mozilla/5.0",
    "curl/8.0",
    "WikiDuel",
    "WikiDuel/0.1",
    "Wikipedia bot",
  ])("rejects missing or generic identity %s", (userAgent) => {
    expect(() => loadWikimediaConfig({ WIKIMEDIA_USER_AGENT: userAgent })).toThrow(
      /WIKIMEDIA_USER_AGENT/,
    );
  });
});
