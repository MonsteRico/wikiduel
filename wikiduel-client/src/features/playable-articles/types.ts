import type { PlayableArticle } from '../../../../wikiduel-server/src/playable-articles/model.js'

export type {
  ArticleAttribution,
  ArticleBlock,
  ArticleDocument,
  ArticleFigure,
  ArticleInline,
  ImageAttribution,
  NavigationDestination,
} from '../../../../wikiduel-server/src/playable-articles/model.js'

export type ArticleRevision = PlayableArticle['revision']
