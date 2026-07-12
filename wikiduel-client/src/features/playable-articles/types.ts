import type { PlayableArticle } from '../../../../wikiduel-server/src/playable-articles/model.js'

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
  ArticleTableOfContentsEntry,
  ImageAttribution,
  NavigationDestination,
  PlayableArticle,
  PlayableArticleFailure,
} from '../../../../wikiduel-server/src/playable-articles/model.js'

export type ArticleRevision = PlayableArticle['revision']
