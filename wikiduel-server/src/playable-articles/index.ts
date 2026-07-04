import { loadWikimediaConfig } from "./config.js";
import { createWikipediaGateway } from "./gateway.js";
import { createPlayableArticleRepository, type PlayableArticleRepository } from "./repository.js";

export type {
  ArticleAttribution,
  ArticleBlock,
  ArticleDocument,
  ArticleInline,
  PlayableArticle,
  PlayableArticleFailure,
  PlayableArticleResult,
} from "./model.js";
export type { PlayableArticleRepository } from "./repository.js";

export function createLivePlayableArticleRepository(
  environment: Readonly<Record<string, string | undefined>>,
): PlayableArticleRepository {
  const config = loadWikimediaConfig(environment);
  return createPlayableArticleRepository(createWikipediaGateway({ userAgent: config.userAgent }));
}
