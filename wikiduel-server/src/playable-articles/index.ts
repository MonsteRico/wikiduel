import { loadWikimediaConfig } from "./config.js";
import { createWikipediaGateway } from "./gateway.js";
import {
  createPlayableArticleRepository,
  type PlayableArticleRepository,
  type PlayableArticleRepositoryOptions,
} from "./repository.js";

export type {
  ArticleAttribution,
  ArticleBlock,
  ArticleDocument,
  ArticleFigure,
  ArticleInline,
  ImageAttribution,
  NavigationDestination,
  PlayableArticle,
  PlayableArticleFailure,
  PlayableArticleResult,
} from "./model.js";
export type {
  PlayableArticleRepository,
  PlayableArticleRepositoryLogger,
  PlayableArticleRepositoryOptions,
} from "./repository.js";

export function createLivePlayableArticleRepository(
  environment: Readonly<Record<string, string | undefined>>,
  options: PlayableArticleRepositoryOptions = {},
): PlayableArticleRepository {
  const config = loadWikimediaConfig(environment);
  return createPlayableArticleRepository(
    createWikipediaGateway({ userAgent: config.userAgent }),
    options,
  );
}
