import { expect, test, vi } from "vitest";

import { createWikipediaGateway, WikipediaGatewayError } from "../playable-articles/gateway.js";
import { createLivePromptEndpointResolver } from "./live-resolver.js";
import { validatePromptCatalogFile } from "./validation.js";

vi.mock("../playable-articles/gateway.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../playable-articles/gateway.js")>(),
  createWikipediaGateway: vi.fn(),
}));

test("validates production endpoints without fetching rate-limited article content", async () => {
  let pageId = 1;
  const fetchPage = vi.fn().mockRejectedValue(new WikipediaGatewayError("rate-limited", 60));
  const fetchImageMetadata = vi.fn();
  const resolveLinks = vi.fn(async (titles: readonly string[]) => titles.map((title) => ({
    requestedTitle: title,
    exists: true as const,
    pageId: pageId++,
    namespace: 0,
    title,
    disambiguation: false,
  })));
  vi.mocked(createWikipediaGateway).mockReturnValue({ fetchPage, fetchImageMetadata, resolveLinks });

  const result = await validatePromptCatalogFile(
    new URL("../../prompts/production.json", import.meta.url),
    createLivePromptEndpointResolver({ WIKIMEDIA_USER_AGENT: "WikiDuel/1.0 (https://example.com)" }),
  );

  expect(result.ok).toBe(true);
  expect(fetchPage).not.toHaveBeenCalled();
  expect(fetchImageMetadata).not.toHaveBeenCalled();
  expect(resolveLinks).toHaveBeenCalledTimes(20);
});
