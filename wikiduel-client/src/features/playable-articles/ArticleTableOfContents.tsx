import type { ArticleTableOfContentsEntry } from "@wikiduel/contracts"

type ArticleTableOfContentsProps = Readonly<{
  entries: readonly ArticleTableOfContentsEntry[]
}>

function jumpToHeading(targetId: string): void {
  const heading = document.getElementById(targetId)
  if (!(heading instanceof HTMLElement)) return

  heading.focus({ preventScroll: true })
  heading.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

export function ArticleTableOfContents({ entries }: ArticleTableOfContentsProps) {
  return (
    <section className="ds-panel p-5" aria-label="Table of contents">
      <h2 className="m-0 font-display text-lg font-extrabold text-ink">Table of contents</h2>
      {entries.length === 0 ? (
        <p className="mt-2 mb-0 text-sm text-ink-soft">No headings in this article.</p>
      ) : (
        <nav className="mt-3" aria-label="Article table of contents">
          <ol className="m-0 grid gap-1 pl-5 text-sm text-ink-soft">
            {entries.map((entry) => (
              <li
                key={entry.targetId}
                aria-level={entry.level}
                style={{ paddingInlineStart: `${Math.max(0, entry.level - 2) * 0.75}rem` }}
              >
                <button
                  className="ds-focus cursor-pointer text-left underline decoration-line/70 underline-offset-2 hover:text-host"
                  type="button"
                  aria-controls={entry.targetId}
                  onClick={() => jumpToHeading(entry.targetId)}
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </section>
  )
}
