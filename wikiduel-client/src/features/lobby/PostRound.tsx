import type { DuelProjection } from '@wikiduel/contracts'
import { Button } from '../../components/ui/Button'
import { useLobby } from './lobbyContext'

type EndedDuel = Extract<DuelProjection, { phase: 'post-round' | 'completed' }>

export function PostRound({ duel }: { duel: EndedDuel }) {
  const { readyForNextRound, readyPending, continueToPostDuel, continuePending, status } = useLobby()
  const { outcome } = duel
  const identities = [duel.self, duel.opponent]
  const winner = identities.find((player) => player.id === outcome.winnerId)!
  const ready = duel.readyPlayerIds.includes(duel.self.id)
  const damage = outcome.damage
  const breakdown = [
    ['Winner clicks', damage.winnerClicks], ['Loser clicks', damage.loserClicks],
    ['Base damage', damage.baseDamage], ['Click differential', damage.clickDifferential],
    ['Click multiplier', damage.clickMultiplier], ['Multiplier contribution', damage.multiplierContribution],
    ['Unclamped damage', damage.unclampedDamage], ['Minimum damage', damage.minimumDamage],
    ['Maximum damage', damage.maximumDamage], ['Final damage', damage.finalDamage],
  ] as const

  return <section className="space-y-6 px-6 py-5" aria-label="Post-Round">
    <div>
      <h2 className="font-display text-xl font-extrabold">{winner.name} won the Round</h2>
      <p>Start: {duel.round.prompt.start.title}</p>
      <p>Target: {duel.round.prompt.target.title}</p>
      {outcome.final && <p>The Duel is complete. Compare the final routes below.</p>}
    </div>
    <div className="grid grid-cols-2 gap-6 max-[560px]:grid-cols-1">
      {outcome.players.map((player) => {
        const identity = identities.find((entry) => entry.id === player.id)!
        return <article key={player.id} aria-label={`${identity.name} Round Outcome`} className="min-w-0 rounded-control border border-line p-4">
          <h3 className="font-display font-bold">{identity.name}{player.id === duel.self.id ? ' · You' : ''}</h3>
          <p>{player.clicks} clicks · {(player.activeElapsedMs / 1000).toFixed(3)} s</p>
          <p className="font-display text-lg">{player.hp} HP</p>
          <ol aria-label={`${identity.name} frozen path`} className="list-inside list-decimal space-y-2 break-words">
            {player.path.map((article, index) => <li key={index}>{article.title}</li>)}
          </ol>
        </article>
      })}
    </div>
    <section aria-label="Damage Rule">
      <h3 className="font-display font-bold">Damage Rule</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
        {breakdown.map(([label, value]) => <div key={label} className="flex justify-between gap-3">
          <dt>{label}</dt><dd className="font-mono">{value}</dd>
        </div>)}
      </dl>
    </section>
    {duel.phase === 'completed' && <Button disabled={continuePending || status !== 'connected'} onClick={continueToPostDuel}>
      Continue to Post-Duel
    </Button>}
    {!outcome.final && <div className="space-y-3">
      <p role="status">{ready || readyPending ? 'You are ready. Waiting for the next Round.' : 'Compare your routes, then ready up.'}
        {' '}{duel.readyPlayerIds.includes(duel.opponent.id) ? 'Your opponent is ready.' : 'Your opponent is not ready yet.'}</p>
      <Button disabled={ready || readyPending || status !== 'connected'} onClick={readyForNextRound}>Ready for Next Round</Button>
    </div>}
  </section>
}
