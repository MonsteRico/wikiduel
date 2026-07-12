export type NavigationDestination = Readonly<{ pageId: number; title: string }>;

export type ArticleInline =
  | Readonly<{ type: "text"; value: string }>
  | Readonly<{ type: "strong"; children: readonly ArticleInline[] }>
  | Readonly<{ type: "emphasis"; children: readonly ArticleInline[] }>
  | Readonly<{
      type: "navigation";
      destination: NavigationDestination;
      children: readonly ArticleInline[];
    }>;

export type ImageAttribution = Readonly<{
  descriptionUrl: string;
  historyUrl: string;
  creator?: string;
  credit?: string;
  licenseName: string;
  licenseUrl: string;
}>;

export type ArticleFigure = Readonly<{
  type: "figure";
  sourceUrl: string;
  width: number;
  height: number;
  alt: string;
  caption: readonly ArticleInline[];
  attribution: ImageAttribution;
}>;

export type ArticleBlock =
  | Readonly<{
      type: "heading";
      targetId: string;
      level: 2 | 3 | 4 | 5 | 6;
      children: readonly ArticleInline[];
    }>
  | Readonly<{ type: "paragraph"; children: readonly ArticleInline[] }>
  | Readonly<{
      type: "list";
      ordered: boolean;
      items: readonly Readonly<{
        children: readonly ArticleInline[];
        blocks: readonly ArticleBlock[];
      }>[];
    }>
  | ArticleFigure;

export type ArticleTableOfContentsEntry = Readonly<{
  targetId: string;
  level: 2 | 3 | 4 | 5 | 6;
  label: string;
}>;

export type ArticleDocument = Readonly<{
  title: string;
  tableOfContents: readonly ArticleTableOfContentsEntry[];
  blocks: readonly ArticleBlock[];
}>;

export type ArticleAttribution = Readonly<{
  sourceUrl: string;
  historyUrl: string;
  licenseName: "Creative Commons Attribution-ShareAlike 4.0 International";
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/";
  modificationNotice: string;
}>;

export type PlayableArticle = Readonly<{
  identity: Readonly<{ pageId: number; title: string }>;
  revision: Readonly<{ id: number; timestamp: string }>;
  attribution: ArticleAttribution;
  document: ArticleDocument;
}>;

export type ArticleNotPlayableReason =
  | "non-main-namespace"
  | "disambiguation"
  | "list"
  | "calendar-year"
  | "calendar-date";

export type PlayableArticleFailure = Readonly<
  | { code: "invalid-title" }
  | { code: "article-not-found" }
  | { code: "article-not-playable"; reason: ArticleNotPlayableReason }
  | { code: "upstream-rate-limited"; retryAfterSeconds?: number }
  | { code: "upstream-unavailable" }
  | { code: "article-normalization-failed" }
  | { code: "article-attribution-incomplete" }
>;

export type PlayableArticleResult =
  | Readonly<{ ok: true; article: PlayableArticle }>
  | Readonly<{ ok: false; failure: PlayableArticleFailure }>;
