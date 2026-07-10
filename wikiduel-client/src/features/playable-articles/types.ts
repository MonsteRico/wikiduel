export type NavigationDestination = Readonly<{ pageId: number; title: string }>

export type ArticleInline =
  | Readonly<{ type: 'text'; value: string }>
  | Readonly<{ type: 'strong'; children: readonly ArticleInline[] }>
  | Readonly<{ type: 'emphasis'; children: readonly ArticleInline[] }>
  | Readonly<{
      type: 'navigation'
      destination: NavigationDestination
      children: readonly ArticleInline[]
    }>

export type ImageAttribution = Readonly<{
  descriptionUrl: string
  historyUrl: string
  creator?: string
  credit?: string
  licenseName: string
  licenseUrl: string
}>

export type ArticleFigure = Readonly<{
  type: 'figure'
  sourceUrl: string
  width: number
  height: number
  alt: string
  caption: readonly ArticleInline[]
  attribution: ImageAttribution
}>

export type ArticleBlock =
  | Readonly<{
      type: 'heading'
      level: 2 | 3 | 4 | 5 | 6
      children: readonly ArticleInline[]
    }>
  | Readonly<{ type: 'paragraph'; children: readonly ArticleInline[] }>
  | Readonly<{
      type: 'list'
      ordered: boolean
      items: readonly Readonly<{
        children: readonly ArticleInline[]
        blocks: readonly ArticleBlock[]
      }>[]
    }>
  | ArticleFigure

export type ArticleDocument = Readonly<{
  title: string
  blocks: readonly ArticleBlock[]
}>

export type ArticleRevision = Readonly<{ id: number; timestamp: string }>

export type ArticleAttribution = Readonly<{
  sourceUrl: string
  historyUrl: string
  licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International'
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
  modificationNotice: string
}>
