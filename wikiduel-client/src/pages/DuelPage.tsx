import { Navigate, useParams } from 'react-router'

import { AppShell } from '../components/ui/AppShell'
import { Panel } from '../components/ui/Panel'
import { PlayerAvatar } from '../components/ui/PlayerAvatar'
import { useLobby } from '../features/lobby/lobbyContext'

export function DuelPage() {
  const { duelId } = useParams()
  const { duel, notice } = useLobby()

  if (!duel || duel.id !== duelId || notice) return <Navigate to="/" replace />

  return (
    <AppShell>
      <section className="grid min-h-[calc(100vh-120px)] place-items-center py-8">
        <Panel as="div" className="w-full max-w-[760px] overflow-hidden motion-safe:animate-arrive">
          <header className="flex items-center justify-between gap-5 border-b border-line px-6 py-5 max-[560px]:px-5">
            <div>
              <p className="ds-label mb-2 text-host">Round {duel.round.number}</p>
              <h1 className="m-0 font-display text-2xl font-extrabold tracking-[0.01em] text-ink">
                Preparing the duel
              </h1>
            </div>
            <span className="rounded-control border border-warning/35 bg-warning/10 px-3 py-2 font-display text-[10px] font-bold tracking-[0.05em] text-warning uppercase">
              Covered
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

          <div className="grid min-h-[300px] place-items-center bg-canvas-deep/30 px-6 py-12 text-center">
            <div className="max-w-[420px]">
              <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-line bg-surface-raised font-display text-xl font-black text-warning" aria-hidden="true">
                ?
              </div>
              <h2 className="m-0 font-display text-xl font-extrabold text-ink">Prompt covered</h2>
              <p className="mt-2 mb-0 text-sm leading-6 text-ink-soft">
                The start and target stay concealed while both players prepare for the Round.
              </p>
            </div>
          </div>
        </Panel>
      </section>
    </AppShell>
  )
}
