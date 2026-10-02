import type { DuelProjection } from '@wikiduel/contracts'
import { Button } from '../../components/ui/Button'
import { useLobby } from './lobbyContext'
import { outcomeExplanation } from './outcomeExplanation'

type PostDuelProjection = Extract<DuelProjection, { phase: 'post-duel' }>

export function PostDuel({ duel }: { duel: PostDuelProjection }) {
  const { requestRematch, rematchPending, backToLobby, backPending, status } = useLobby()
  const { summary } = duel
  const requested = duel.rematchPlayerIds.includes(duel.self.id)
  const opponentRequested = duel.rematchPlayerIds.includes(duel.opponent.id)
  const name = (id: string) => summary.players.find((player) => player.id === id)!.name

  return <section aria-label="Post-Duel" className="space-y-6 px-6 py-5">
    <div>
      <h2 className="font-display text-xl font-extrabold">{name(summary.winnerId)} won the Duel</h2>
      <p>HP reached zero. The Duel is complete.</p>
    </div>
    <ul aria-label="Final HP" className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
      {summary.players.map((player) => <li key={player.id} className="rounded-control border border-line p-4 font-display text-lg">
        {player.name}: {player.hp} HP
      </li>)}
    </ul>
    <div>
      <h3 className="font-display font-bold">Damage by Round</h3>
      <ol aria-label="Damage by Round" className="mt-2 space-y-2">
        {summary.rounds.map((round) => <li key={round.roundId}>
          Round {round.roundNumber}: {round.winnerId === null ? 'Draw, no damage' : `${name(round.winnerId)} dealt ${round.damage} damage`}
          <p className="text-sm text-ink-soft">{outcomeExplanation[round.winReason]}</p>
        </li>)}
      </ol>
    </div>
    <div className="space-y-3">
      <p role="status">{requested ? `Waiting for ${duel.opponent.name} to request a Rematch.`
        : opponentRequested ? `${duel.opponent.name} wants a Rematch.` : 'Both players must request a Rematch to play again.'}</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={status !== 'connected' || requested || rematchPending || backPending} onClick={requestRematch}>Rematch</Button>
        <Button variant="secondary" disabled={status !== 'connected' || backPending} onClick={backToLobby}>Back to Lobby</Button>
      </div>
    </div>
  </section>
}
