import type { Lobby, LobbyMember } from '@wikiduel/contracts'
import { Button } from '../../components/ui/Button'
import { ArrowRightIcon } from '../../components/ui/Icons'
import { PlayerAvatar } from '../../components/ui/PlayerAvatar'
import { StatusIndicator } from '../../components/ui/StatusIndicator'

type PlayerRosterProps = {
  lobby: Lobby | null
  currentMember: LobbyMember | undefined
  error: string | null
  onSetReady: (ready: boolean) => void
  onStartDuel: () => void
}

export function PlayerRoster({ lobby, currentMember, error, onSetReady, onStartDuel }: PlayerRosterProps) {
  const bothPlayersReady = lobby?.members.length === 2
    && lobby.members.every((member) => member.connected && member.ready)
  const isHost = currentMember?.role === 'host'

  return (
    <section aria-labelledby="roster-heading">
      <div className="flex items-center justify-between gap-5 border-b border-line-soft px-6 py-4 max-[560px]:px-5">
        <h2 className="ds-label m-0 text-ink" id="roster-heading">Players</h2>
        <span className="font-mono text-[11px] text-ink-soft">{lobby?.members.length ?? 0} / 2 joined</span>
      </div>

      {error ? <p className="m-0 border-b border-line-soft bg-danger/10 px-6 py-4 text-sm text-danger" role="alert">{error}</p> : null}
      {!lobby && !error ? <p className="m-0 border-b border-line-soft px-6 py-5 text-sm text-ink-soft">Joining lobby…</p> : null}

      <ul className="m-0 list-none p-0">
        {lobby?.members.map((member) => (
          <li className="grid min-h-[82px] grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line-soft px-6 py-4 max-[560px]:px-5" key={member.id}>
            <PlayerAvatar role={member.role} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <strong className={`font-display text-sm font-extrabold tracking-[0.025em] uppercase ${member.role === 'host' ? 'text-host' : 'text-opponent'}`}>{member.name}</strong>
                {member.id === currentMember?.id ? <span className="text-[10px] text-ink-faint">You</span> : null}
              </div>
              <span className="mt-1 block text-xs text-ink-soft">{member.role === 'host' ? 'Lobby host' : 'Opponent'}</span>
            </div>
            <div className="grid justify-items-end gap-2">
              <StatusIndicator tone={member.connected ? 'success' : 'warning'}>{member.connected ? 'Connected' : 'Offline'}</StatusIndicator>
              <span className={`rounded-[3px] border px-2 py-1 font-display text-[9px] font-bold tracking-[0.04em] uppercase ${member.ready ? 'border-success/40 bg-success/10 text-success' : 'border-line text-ink-faint'}`}>
                {member.ready ? 'Ready' : 'Not ready'}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {currentMember ? (
        <div className="flex items-center justify-between gap-6 bg-canvas-deep/18 px-6 py-5 max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:px-5">
          <div>
            <p className="ds-label mb-1.5">Your status</p>
            <strong className="text-sm font-semibold text-ink">{bothPlayersReady ? 'Both players are ready.' : currentMember.ready ? 'Waiting for your opponent.' : 'Ready when you are.'}</strong>
          </div>
          <div className="flex shrink-0 items-center gap-2 max-[560px]:grid max-[560px]:grid-cols-1">
            <Button variant="secondary" onClick={() => onSetReady(!currentMember.ready)}>
              {currentMember.ready ? 'Cancel ready' : 'I’m ready'}
            </Button>
            {isHost ? (
              <Button icon={<ArrowRightIcon />} onClick={onStartDuel} disabled={!bothPlayersReady}>Start duel</Button>
            ) : (
              <span className="px-2 text-xs text-ink-soft">The host starts the duel.</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
