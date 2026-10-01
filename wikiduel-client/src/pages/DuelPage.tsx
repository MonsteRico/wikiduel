import { Navigate, useParams } from 'react-router'
import { Component, useEffect, useState, type ReactNode } from 'react'
import type { DuelProjection } from '@wikiduel/contracts'

import { AppShell } from '../components/ui/AppShell'
import { Panel } from '../components/ui/Panel'
import { PlayerAvatar } from '../components/ui/PlayerAvatar'
import { useLobby } from '../features/lobby/lobbyContext'
import { PlayableArticleArea } from '../features/playable-articles/PlayableArticleArea'

class ArticleRenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <p role="alert">The article could not render. Waiting for the preparation deadline.</p>
      : this.props.children
  }
}

function RoundArticle({ duel, active }: { duel: DuelProjection, active: boolean }) {
  const { acknowledgeRendered, navigate } = useLobby()
  const article = duel.round.article
  useEffect(() => {
    if (article && duel.phase === 'preparing') acknowledgeRendered(duel.id, duel.round.id)
  }, [article, duel.id, duel.phase, duel.round.id, acknowledgeRendered])
  if (!article) return null
  return <div hidden={!active} inert={!active} aria-hidden={!active}>
    <PlayableArticleArea article={article} onNavigate={navigate} />
  </div>
}

export function DuelPage() {
  const { duelId } = useParams()
  const { duel, notice, getServerTime } = useLobby()
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 50)
    return () => window.clearInterval(timer)
  }, [])

  if (!duel || duel.id !== duelId || notice) return <Navigate to="/" replace />
  const elapsed = duel.phase === 'preparing' ? null : getServerTime() - duel.startsAt
  const active = elapsed !== null && elapsed >= 0
  const seconds = Math.floor(Math.max(0, elapsed ?? 0) / 1000)
  const stopwatch = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <AppShell>
      <section className="grid min-h-[calc(100vh-120px)] place-items-center py-8">
        <Panel as="div" className="w-full max-w-[760px] overflow-hidden motion-safe:animate-arrive">
          <header className="flex items-center justify-between gap-5 border-b border-line px-6 py-5 max-[560px]:px-5">
            <div>
              <p className="ds-label mb-2 text-host">Round {duel.round.number}</p>
              <h1 className="m-0 font-display text-2xl font-extrabold tracking-[0.01em] text-ink">
                {duel.phase === 'preparing' ? 'Preparing the duel' : active ? 'Round in progress' : 'Get ready'}
              </h1>
            </div>
            <span className="rounded-control border border-warning/35 bg-warning/10 px-3 py-2 font-display text-[10px] font-bold tracking-[0.05em] text-warning uppercase">
              {active ? 'Active' : 'Covered'}
            </span>
          </header>

          <div className="grid grid-cols-2 border-b border-line-soft max-[560px]:grid-cols-1">
            {[duel.self, duel.opponent].map((player) => (
              <article className="flex items-center gap-4 border-r border-line-soft px-6 py-5 last:border-r-0 max-[560px]:border-r-0 max-[560px]:border-b max-[560px]:last:border-b-0" key={player.id}>
                <PlayerAvatar role={player.role} />
                <div className="min-w-0 flex-1">
                  <p className={`ds-label mb-1 ${player.role === 'host' ? 'text-host' : 'text-opponent'}`}>
                    {player.id === duel.self.id ? 'You' : 'Opponent'}
                  </p>
                  <strong className="font-display text-lg text-ink">{player.hp} HP</strong>
                </div>
                {player.id === duel.self.id ? (
                  <span className="font-mono text-xs text-ink-soft">{duel.self.clicks} clicks</span>
                ) : null}
              </article>
            ))}
          </div>

          {duel.phase !== 'preparing' && <div className="px-6 py-5 text-center">
            <p>Start: {duel.round.prompt.start.title}</p>
            <p>Target: {duel.round.prompt.target.title}</p>
            <p role="timer" aria-label={active ? 'Elapsed time' : 'Round countdown'} className="font-mono text-3xl">
              {active ? stopwatch : Math.ceil(-(elapsed ?? 0) / 1000)}
            </p>
          </div>}
          {!active && <div className="grid min-h-[300px] place-items-center bg-canvas-deep/30 px-6 py-12 text-center">
            <div className="max-w-[420px]">
              <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-line bg-surface-raised font-display text-xl font-black text-warning" aria-hidden="true">
                ?
              </div>
              <h2 className="m-0 font-display text-xl font-extrabold text-ink">{duel.phase === 'preparing' ? 'Prompt covered' : 'Article covered'}</h2>
              <p className="mt-2 mb-0 text-sm leading-6 text-ink-soft">
                {duel.phase === 'preparing' ? 'The start and target stay concealed while both players prepare for the Round.' : 'Navigation begins when the countdown reaches zero.'}
              </p>
            </div>
          </div>}
          <ArticleRenderBoundary key={duel.round.id}>
            <RoundArticle duel={duel} active={active} />
          </ArticleRenderBoundary>
        </Panel>
      </section>
    </AppShell>
  )
}
