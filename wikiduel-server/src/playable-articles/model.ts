import type { PlayableArticle, PlayableArticleFailure } from '@wikiduel/contracts'

export type {
  ArticleAttribution,
  ArticleBlock,
  ArticleDocument,
  ArticleFigure,
  ArticleInline,
  ArticleInfobox,
  ArticleInfoboxItem,
  ArticleInfoboxSection,
  ArticleList,
  ArticleListItem,
  ArticleMediaPlaceholder,
  ArticleNotPlayableReason,
  ArticleTableOfContentsEntry,
  ImageAttribution,
  NavigationDestination,
  PlayableArticle,
  PlayableArticleFailure,
} from '@wikiduel/contracts'

export type PlayableArticleResult =
  | Readonly<{ ok: true; article: PlayableArticle }>
  | Readonly<{ ok: false; failure: PlayableArticleFailure }>
