import { Panel } from '../../components/ui/Panel'
import { ArticleDocumentRenderer } from './ArticleDocumentRenderer'
import type { NavigationDestination, PlayableArticle } from './types'

type PlayableArticleAreaProps = Readonly<{
  article: PlayableArticle
  onNavigate: (destination: NavigationDestination) => void
}>

export function PlayableArticleArea({ article, onNavigate }: PlayableArticleAreaProps) {
  return (
    <Panel
      as="section"
      className="overflow-hidden border-host/35 bg-surface p-0"
      aria-label="Playable Article area"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas-deep/72 px-4 py-3">
        <div>
          <p className="ds-label text-host">Current article</p>
          <h2 className="m-0 font-display text-xl font-extrabold text-ink">{article.identity.title}</h2>
        </div>
        <div
          className="rounded-control border border-line bg-surface-muted px-3 py-2 font-mono text-xs font-bold text-ink-soft"
          aria-label={`Wikipedia page ID ${article.identity.pageId}`}
        >
          #{article.identity.pageId}
        </div>
      </div>
      <div className="wd-article-canvas">
        <ArticleDocumentRenderer
          document={article.document}
          revision={article.revision}
          attribution={article.attribution}
          onNavigate={onNavigate}
        />
      </div>
    </Panel>
  )
}
