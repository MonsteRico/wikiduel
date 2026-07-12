import { useId, useState, type ReactNode } from 'react'

import { Button } from '../../components/ui/Button'
import type {
  ArticleBlock,
  ArticleFigure,
  ArticleInfobox as ArticleInfoboxBlock,
  ArticleInline,
  NavigationDestination,
} from './types'

type InfoboxProps = Readonly<{
  block: ArticleInfoboxBlock
  onNavigate: (destination: NavigationDestination) => void
}>

type Navigate = InfoboxProps['onNavigate']

function renderInline(inline: ArticleInline, key: string, onNavigate: Navigate): ReactNode {
  switch (inline.type) {
    case 'text':
      return inline.value
    case 'strong':
      return (
        <strong key={key}>
          {inline.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
        </strong>
      )
    case 'emphasis':
      return (
        <em key={key}>
          {inline.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
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
          {inline.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
        </Button>
      )
  }
}

function renderFigure(figure: ArticleFigure, key: string, onNavigate: Navigate): ReactNode {
  return (
    <figure key={key}>
      <img
        src={figure.sourceUrl}
        width={figure.width}
        height={figure.height}
        alt={figure.alt}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        {figure.caption.length > 0 ? (
          <div>{figure.caption.map((child, index) => renderInline(child, `${key}-caption-${index}`, onNavigate))}</div>
        ) : null}
        <div aria-label="Image attribution">
          {figure.attribution.creator ? (
            <div>Creator: <span>{figure.attribution.creator}</span></div>
          ) : null}
          {figure.attribution.credit ? (
            <div>Credit: <span>{figure.attribution.credit}</span></div>
          ) : null}
          <a href={figure.attribution.descriptionUrl}>Image source</a>
          {' | '}
          <a href={figure.attribution.historyUrl}>Image history</a>
          {' | License: '}
          <a href={figure.attribution.licenseUrl}>{figure.attribution.licenseName}</a>
        </div>
      </figcaption>
    </figure>
  )
}

function renderBlock(block: ArticleBlock, key: string, onNavigate: Navigate): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return (
        <p key={key}>
          {block.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
        </p>
      )
    case 'line':
      return (
        <div key={key} className="wd-infobox-line">
          {block.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
        </div>
      )
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`}>
              {item.children.map((child, index) => renderInline(child, `${key}-${itemIndex}-${index}`, onNavigate))}
              {item.blocks.map((child, index) => renderBlock(child, `${key}-${itemIndex}-block-${index}`, onNavigate))}
            </li>
          ))}
        </List>
      )
    }
    case 'figure':
      return renderFigure(block, key, onNavigate)
    case 'media-placeholder':
      return (
        <p key={key} className="wd-infobox-media" role="note">
          {block.kind === 'audio' ? 'Audio element omitted.' : 'Video element omitted.'}
        </p>
      )
    case 'infobox':
      return <Infobox key={key} block={block} onNavigate={onNavigate} />
    case 'heading':
      return (
        <div key={key}>
          {block.children.map((child, index) => renderInline(child, `${key}-${index}`, onNavigate))}
        </div>
      )
  }
}

export function Infobox({ block, onNavigate }: InfoboxProps) {
  const [expanded, setExpanded] = useState(true)
  const contentId = `infobox-content-${useId().replace(/:/g, '')}`

  return (
    <aside className="wd-infobox" aria-label="Infobox">
      <div className="wd-infobox-header">
        <div className="wd-infobox-title">
          {block.title
            ? block.title.map((child, index) => renderInline(child, `title-${index}`, onNavigate))
            : 'Infobox'}
        </div>
        <button
          type="button"
          className="wd-infobox-toggle"
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Collapse infobox' : 'Expand infobox'}
        </button>
      </div>
      <div id={contentId} hidden={!expanded} className="wd-infobox-content">
        {block.sections.map((section, sectionIndex) => (
          <section key={`section-${sectionIndex}`} className="wd-infobox-section">
            {section.label ? (
              <div className="wd-infobox-section-label">
                {section.label.map((child, index) => renderInline(child, `section-${sectionIndex}-${index}`, onNavigate))}
              </div>
            ) : null}
            <dl>
              {section.items.map((item, itemIndex) => (
                <div key={`item-${sectionIndex}-${itemIndex}`} className="wd-infobox-item">
                  {item.label ? (
                    <dt>{item.label.map((child, index) => renderInline(child, `label-${sectionIndex}-${itemIndex}-${index}`, onNavigate))}</dt>
                  ) : null}
                  {item.blocks.length > 0 ? (
                    <dd>{item.blocks.map((child, index) => renderBlock(child, `content-${sectionIndex}-${itemIndex}-${index}`, onNavigate))}</dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  )
}
