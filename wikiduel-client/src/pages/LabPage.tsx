import { useEffect, useRef, useState, type FormEvent } from 'react'

import { AppShell } from '../components/ui/AppShell'
import { PlayableArticleArea } from '../features/playable-articles/PlayableArticleArea'
import type {
  NavigationDestination,
  PlayableArticle,
  PlayableArticleFailure,
} from '../features/playable-articles/types'
import type {
  PreviewDiagnostics,
  PreviewOmissionBucket,
} from '../../../wikiduel-server/src/playable-articles/preview.js'
import { useWebSocket } from '../websocket/webSocketContext'

type LabFailure = PlayableArticleFailure | Readonly<{
  code: 'malformed-message' | 'preview-unavailable'
}>

type NavigationHistoryEntry = Readonly<{
  fromTitle: string
  destination: NavigationDestination
}>

function formatFailure(failure: LabFailure): string {
  switch (failure.code) {
    case 'article-not-found':
      return 'No article was found for that title.'
    case 'article-not-playable':
      return failure.reason
        ? `That page is not a Playable Article (${failure.reason}).`
        : 'That page is not a Playable Article.'
    case 'invalid-title':
      return 'Enter a valid Wikipedia article title.'
    case 'upstream-rate-limited':
      return 'Wikimedia rate-limited this request.'
    case 'upstream-unavailable':
      return 'Wikimedia is temporarily unavailable.'
    case 'preview-unavailable':
      return 'The Playable Article Lab is unavailable in this build.'
    case 'malformed-message':
      return 'The preview request was malformed.'
    default:
      return 'The article could not be loaded.'
  }
}

function OmissionSummary({ label, bucket }: Readonly<{
  label: string
  bucket: PreviewOmissionBucket
}>) {
  return (
    <li>
      <span>{label}: {bucket.count}</span>
      {bucket.reasons.length > 0 ? <span> ({bucket.reasons.join(', ')})</span> : null}
      {bucket.examples.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer">Examples ({bucket.examples.length})</summary>
          <ul className="mt-1 grid gap-1 pl-5">
            {bucket.examples.map((example, index) => (
              <li key={`${example.reason}-${example.subject ?? index}`}>
                {example.subject ? `${example.subject} — ` : null}{example.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  )
}

function DiagnosticsPanel({ diagnostics }: Readonly<{ diagnostics: PreviewDiagnostics }>) {
  return (
    <aside className="lg:sticky lg:top-6" aria-label="Sticky article diagnostics">
      <section className="ds-panel p-5" aria-label="Article diagnostics">
        <h2 className="m-0 font-display text-lg font-extrabold text-ink">Diagnostics</h2>
        {diagnostics.wikipediaUrl ? (
          <p className="mt-2 mb-0 text-sm">
            <a
              className="text-host underline underline-offset-2"
              href={diagnostics.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open on Wikipedia
            </a>
          </p>
        ) : null}
      <dl className="mt-4 grid gap-2 text-sm text-ink-soft">
        <div><dt className="inline font-semibold text-ink">Requested title:</dt>{' '}<dd className="inline">{diagnostics.requestedTitle}</dd></div>
        <div>
          <dt className="inline font-semibold text-ink">Canonical identity:</dt>{' '}
          <dd className="inline">
            {diagnostics.canonicalIdentity
              ? `${diagnostics.canonicalIdentity.title} (#${diagnostics.canonicalIdentity.pageId})`
              : '—'}
          </dd>
        </div>
        <div><dt className="inline font-semibold text-ink">Revision:</dt>{' '}<dd className="inline">{diagnostics.revision ? `${diagnostics.revision.id} at ${diagnostics.revision.timestamp}` : '—'}</dd></div>
        <div><dt className="inline font-semibold text-ink">Duration:</dt>{' '}<dd className="inline">{diagnostics.durationMs} ms</dd></div>
        <div><dt className="inline font-semibold text-ink">Cache:</dt>{' '}<dd className="inline">{diagnostics.cacheOutcome}</dd></div>
      </dl>

      <h3 className="mt-5 mb-2 font-display text-sm font-extrabold tracking-[0.04em] text-ink uppercase">Emitted nodes</h3>
      <ul className="m-0 grid gap-1 pl-5 text-sm text-ink-soft">
        {Object.entries(diagnostics.emittedNodeCounts).map(([name, count]) => (
          <li key={name}>{name}: {count}</li>
        ))}
      </ul>

      <h3 className="mt-5 mb-2 font-display text-sm font-extrabold tracking-[0.04em] text-ink uppercase">Omitted content</h3>
      <ul className="m-0 grid gap-1 pl-5 text-sm text-ink-soft">
        <OmissionSummary label="Structure" bucket={diagnostics.omissions.structure} />
        <OmissionSummary label="Links" bucket={diagnostics.omissions.links} />
        <OmissionSummary label="Images" bucket={diagnostics.omissions.images} />
        <OmissionSummary label="Image attribution" bucket={diagnostics.omissions.imageAttribution} />
      </ul>

      <p className="mt-5 mb-0 text-sm text-ink-soft">
        Retry attempts: {diagnostics.retry.attempts}
        {diagnostics.retry.retryAfterSeconds === undefined
          ? null
          : `; upstream retry timing: ${diagnostics.retry.retryAfterSeconds} seconds`}
      </p>
      </section>
    </aside>
  )
}

export function LabPage() {
  const webSocket = useWebSocket()
  const [titleInput, setTitleInput] = useState('')
  const [lastRequestedTitle, setLastRequestedTitle] = useState('')
  const [article, setArticle] = useState<PlayableArticle | null>(null)
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null)
  const [failure, setFailure] = useState<LabFailure | null>(null)
  const [retrySecondsRemaining, setRetrySecondsRemaining] = useState<number | undefined>()
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null)
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryEntry[]>([])
  const requestCounter = useRef(0)
  const activeRequestId = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribeResult = webSocket.subscribe('preview-article-result', (message) => {
      if (message.requestId !== activeRequestId.current) return

      setLoadingTitle(null)
      setDiagnostics(message.diagnostics)
      if (message.ok) {
        setArticle(message.article)
        setFailure(null)
        setRetrySecondsRemaining(undefined)
      } else {
        setFailure(message.failure)
        setRetrySecondsRemaining(
          'retryAfterSeconds' in message.failure ? message.failure.retryAfterSeconds : undefined,
        )
      }
    })
    const unsubscribeError = webSocket.subscribe('preview-error', (message) => {
      if (message.requestId && message.requestId !== activeRequestId.current) return

      setLoadingTitle(null)
      setFailure(message.failure)
      setRetrySecondsRemaining(undefined)
    })
    return () => {
      unsubscribeResult()
      unsubscribeError()
    }
  }, [webSocket])

  useEffect(() => {
    if (retrySecondsRemaining === undefined || retrySecondsRemaining <= 0) return
    const timer = window.setInterval(() => {
      setRetrySecondsRemaining((current) => current === undefined ? current : Math.max(0, current - 1))
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [retrySecondsRemaining])

  const requestArticle = (requestedTitle: string) => {
    const trimmedTitle = requestedTitle.trim()
    if (!trimmedTitle) return

    requestCounter.current += 1
    const requestId = `lab-${requestCounter.current}`
    activeRequestId.current = requestId
    setTitleInput(trimmedTitle)
    setLastRequestedTitle(trimmedTitle)
    setLoadingTitle(trimmedTitle)
    setFailure(null)
    setRetrySecondsRemaining(undefined)

    const sent = webSocket.send({
      type: 'preview-article',
      requestId,
      requestedTitle: trimmedTitle,
    })
    if (!sent) {
      setLoadingTitle(null)
      setFailure({ code: 'upstream-unavailable' })
    }
  }

  const submitTitle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestArticle(titleInput)
  }

  const handleNavigation = (destination: NavigationDestination) => {
    setNavigationHistory((history) => [
      ...history,
      { fromTitle: article?.identity.title ?? 'Unknown article', destination },
    ])
    requestArticle(destination.title)
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="ds-panel p-6" aria-labelledby="lab-heading">
          <p className="ds-label mb-2 text-host">Development-only</p>
          <h1 className="m-0 font-display text-3xl font-black tracking-[0.015em] text-ink" id="lab-heading">Playable Article Lab</h1>
          <p className="mt-2 mb-0 max-w-[680px] text-sm leading-6 text-ink-soft">
            Request a live English Wikipedia title, inspect its safe Article Document, and follow canonical Navigation Nodes.
          </p>
          <form className="mt-5 flex gap-3 max-[640px]:flex-col" onSubmit={submitTitle} aria-label="Article preview form">
            <label className="sr-only" htmlFor="wikipedia-title">Wikipedia title</label>
            <input
              className="ds-focus h-12 min-w-0 flex-1 rounded-control border border-line bg-canvas-deep/35 px-4 text-ink"
              id="wikipedia-title"
              value={titleInput}
              onChange={(event) => setTitleInput(event.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="off"
            />
            <button
              className="ds-focus min-h-12 cursor-pointer rounded-control border border-host-strong bg-host-strong px-5 font-display text-xs font-extrabold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-40"
              type="submit"
              disabled={!titleInput.trim() || loadingTitle !== null}
            >
              {loadingTitle ? 'Loading…' : 'Load article'}
            </button>
          </form>
          <div className="mt-3 min-h-5 text-sm text-ink-soft" role="status" aria-live="polite">
            {loadingTitle ? `Loading ${loadingTitle}` : article && !failure ? `Loaded ${article.identity.title}` : 'Ready'}
          </div>
          {failure ? (
            <div className="ds-inset mt-3 flex flex-wrap items-center justify-between gap-3 border-danger/40 bg-danger/10 px-4 py-3 text-sm text-ink" role="alert">
              <span>{formatFailure(failure)}{retrySecondsRemaining === undefined ? '' : ` Retry available in ${retrySecondsRemaining} seconds.`}</span>
              <button className="ds-focus cursor-pointer rounded-control border border-line px-3 py-2 font-semibold text-ink" type="button" onClick={() => requestArticle(lastRequestedTitle)} disabled={loadingTitle !== null}>
                Retry article
              </button>
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
          <div className="grid min-w-0 gap-6">
          {article ? (
          <PlayableArticleArea
            article={article}
            onNavigate={handleNavigation}
          />
        ) : null}

        <section className="ds-panel p-5" aria-label="Navigation history">
          <h2 className="m-0 font-display text-lg font-extrabold text-ink">Navigation history</h2>
          {navigationHistory.length === 0 ? (
            <p className="mt-2 mb-0 text-sm text-ink-soft">No Navigation yet.</p>
          ) : (
            <ol className="mt-3 mb-0 grid gap-2 pl-5 text-sm text-ink-soft">
              {navigationHistory.map((entry, index) => (
                <li key={`${entry.destination.pageId}-${index}`}>
                  {entry.fromTitle} → {entry.destination.title} (#{entry.destination.pageId})
                </li>
              ))}
            </ol>
          )}
        </section>
          </div>
          {diagnostics ? <DiagnosticsPanel diagnostics={diagnostics} /> : null}
        </div>
      </div>
    </AppShell>
  )
}
