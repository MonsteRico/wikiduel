import { createElement, type ReactNode } from 'react'

import { Button } from '../../components/ui/Button'
import { Infobox } from './Infobox'
import type { ArticleAttribution, ArticleBlock, ArticleDocument, ArticleInline, NavigationDestination, PlayableArticle } from '@wikiduel/contracts'

export type ArticleRevision = PlayableArticle["revision"];

type ArticleDocumentRendererProps = Readonly<{
  document: ArticleDocument
  revision: ArticleRevision
  attribution: ArticleAttribution
  onNavigate: (destination: NavigationDestination) => void
}>

type Navigate = ArticleDocumentRendererProps['onNavigate']

function renderInline(inline: ArticleInline, key: number, onNavigate: Navigate): ReactNode {
  switch (inline.type) {
    case 'text':
      return inline.value
    case 'strong':
      return (
        <strong key={key}>
          {inline.children.map((child, index) => renderInline(child, index, onNavigate))}
        </strong>
      )
    case 'emphasis':
      return (
        <em key={key}>
          {inline.children.map((child, index) => renderInline(child, index, onNavigate))}
        </em>
      )
    case 'navigation':
      return (
        <Button
          key={key}
          type="button"
          variant="inline"
          onClick={() => onNavigate(inline.destination)}
        >
          {inline.children.map((child, index) => renderInline(child, index, onNavigate))}
        </Button>
      )
  }
}

function renderBlock(block: ArticleBlock, key: number, onNavigate: Navigate): ReactNode {
  switch (block.type) {
    case 'heading':
      return createElement(
        `h${block.level}`,
        { id: block.targetId, key, tabIndex: -1 },
        block.children.map((child, index) => renderInline(child, index, onNavigate)),
      )
    case 'paragraph':
      return (
        <p key={key}>
          {block.children.map((child, index) => renderInline(child, index, onNavigate))}
        </p>
      )
    case 'line':
      return (
        <div key={key}>
          {block.children.map((child, index) => renderInline(child, index, onNavigate))}
        </div>
      )
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {item.children.map((child, index) => renderInline(child, index, onNavigate))}
              {item.blocks.map((child, index) => renderBlock(child, index, onNavigate))}
            </li>
          ))}
        </List>
      )
    }
    case 'figure':
      return (
        <figure key={key}>
          <img
            src={block.sourceUrl}
            width={block.width}
            height={block.height}
            alt={block.alt}
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            {block.caption.length > 0 ? (
              <div>
                {block.caption.map((child, index) => renderInline(child, index, onNavigate))}
              </div>
            ) : null}
            <div aria-label="Image attribution">
              {block.attribution.creator ? (
                <div>
                  Creator: <span>{block.attribution.creator}</span>
                </div>
              ) : null}
              {block.attribution.credit ? (
                <div>
                  Credit: <span>{block.attribution.credit}</span>
                </div>
              ) : null}
              <a href={block.attribution.descriptionUrl}>Image source</a>
              {' | '}
              <a href={block.attribution.historyUrl}>Image history</a>
              {' | License: '}
              <a href={block.attribution.licenseUrl}>{block.attribution.licenseName}</a>
            </div>
          </figcaption>
        </figure>
      )
    case 'media-placeholder':
      return (
        <p key={key} role="note">
          {block.kind === 'audio' ? 'Audio element omitted.' : 'Video element omitted.'}
        </p>
      )
    case 'infobox':
      return <Infobox key={key} block={block} onNavigate={onNavigate} />
  }
}

export function ArticleDocumentRenderer({
  document,
  revision,
  attribution,
  onNavigate,
}: ArticleDocumentRendererProps) {
  return (
    <article>
      <h1>{document.title}</h1>
      {document.blocks.map((block, index) => renderBlock(block, index, onNavigate))}
      <footer aria-label="Article attribution">
        <div>
          <span>Revision {revision.id}</span>
          {' | '}
          <time dateTime={revision.timestamp}>{revision.timestamp}</time>
        </div>
        <div>
          <a href={attribution.sourceUrl}>Article source</a>
          {' | '}
          <a href={attribution.historyUrl}>Page history</a>
          {' | License: '}
          <a href={attribution.licenseUrl}>{attribution.licenseName}</a>
        </div>
        <p>{attribution.modificationNotice}</p>
      </footer>
    </article>
  )
}
