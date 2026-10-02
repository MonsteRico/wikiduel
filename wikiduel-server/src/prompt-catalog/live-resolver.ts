import { loadWikimediaConfig } from "../playable-articles/config.js";
import { createWikipediaGateway } from "../playable-articles/gateway.js";
import { createPlayableArticleIdentityResolver } from "../playable-articles/repository.js";
import type { PromptEndpointResolver } from "./catalog.js";

export function createLivePromptEndpointResolver(
  environment: Readonly<Record<string, string | undefined>>,
): PromptEndpointResolver {
  return createPlayableArticleIdentityResolver(createWikipediaGateway(loadWikimediaConfig(environment)));
}
