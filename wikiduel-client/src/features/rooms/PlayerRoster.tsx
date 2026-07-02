import type { Room, RoomMember } from './types'

type PlayerRosterProps = {
  room: Room | null
  currentMember: RoomMember | undefined
  error: string | null
  onSetReady: (ready: boolean) => void
  onStartGame: () => void
}

export function PlayerRoster({
  room,
  currentMember,
  error,
  onSetReady,
  onStartGame,
}: PlayerRosterProps) {
  const bothPlayersReady = room?.members.length === 2
    && room.members.every((member) => member.connected && member.ready)
  const isHost = currentMember?.role === 'host'

  return (
    <section
      className="border border-ink bg-paper motion-safe:animate-arrive motion-safe:[animation-delay:80ms]"
      aria-labelledby="roster-heading"
    >
      <div className="flex items-end justify-between border-b border-ink px-8 py-7 max-[760px]:px-[18px]">
        <div>
          <p className="mb-3 text-xs font-black tracking-[0.16em] text-ink-soft uppercase">Match lobby</p>
          <h2 className="mb-0 font-display text-[clamp(30px,4vw,46px)] tracking-[-0.05em] text-ink" id="roster-heading">Players</h2>
        </div>
        <span className="font-mono text-xs uppercase">{room?.members.length ?? 0} joined</span>
      </div>

      {error ? <p className="m-0 px-8 py-6 text-danger" role="alert">{error}</p> : null}
      {!room && !error ? <p className="m-0 px-8 py-6 text-ink-soft">Joining room...</p> : null}

      <ul className="m-0 list-none p-0">
        {room?.members.map((member, index) => (
          <li
            className="grid min-h-[94px] grid-cols-[44px_56px_1fr_auto] items-center gap-[18px] border-b border-line px-8 py-[18px] last:border-b-0 max-[760px]:grid-cols-[42px_1fr_auto] max-[760px]:gap-3 max-[760px]:px-[18px]"
            key={member.id}
          >
            <div className="font-mono text-xs text-ink-soft max-[760px]:hidden">{String(index + 1).padStart(2, '0')}</div>
            <div className="grid size-[52px] place-items-center border border-ink bg-canvas font-display text-[22px] font-black text-ink" aria-hidden="true">{member.name.charAt(0)}</div>
            <div>
              <strong className="block text-[17px] text-ink">{member.name}</strong>
              <span className="mt-1 block text-xs text-ink-soft max-[760px]:hidden">{member.role === 'host' ? 'Room host' : 'Challenger'}</span>
            </div>
            <div className="grid justify-items-end gap-[9px]">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-ink-soft uppercase max-[760px]:text-[10px]">
                <span
                  className={`size-2 rounded-full ${member.connected ? 'bg-signal shadow-[0_0_0_4px_rgb(167_255_74/20%)]' : 'bg-warning'}`}
                  aria-hidden="true"
                />
                {member.connected ? 'Connected' : 'Offline'}
              </div>
              <div className={`border px-2 py-1 font-mono text-[10px] font-extrabold tracking-[0.08em] uppercase ${member.ready ? 'border-ink bg-signal text-ink' : 'border-line text-ink-soft'}`}>
                {member.ready ? 'Ready' : 'Not ready'}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {currentMember ? (
        <div className="flex items-center justify-between gap-7 border-t border-ink bg-canvas px-8 py-[26px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:px-[18px] max-[760px]:py-[22px]">
          <div>
            <p className="mb-[5px] text-xs font-black tracking-[0.16em] text-ink-soft uppercase">Your status</p>
            <strong className="text-ink">{bothPlayersReady ? 'Both players are ready.' : 'Ready when you are.'}</strong>
          </div>
          <div className="flex items-center gap-3 max-[760px]:flex-col max-[760px]:items-stretch">
            <button
              className="min-h-[46px] cursor-pointer border border-ink bg-paper px-[18px] text-xs font-black tracking-[0.05em] text-ink uppercase hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#a7ff4a] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark max-[760px]:w-full"
              type="button"
              onClick={() => onSetReady(!currentMember.ready)}
            >
              {currentMember.ready ? 'Cancel ready' : "I'm ready"}
            </button>
            {isHost ? (
              <button
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-7 border border-ink bg-ink px-[18px] text-xs font-black tracking-[0.05em] text-paper uppercase hover:not-disabled:-translate-x-0.5 hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[4px_4px_0_#a7ff4a] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark disabled:cursor-not-allowed disabled:opacity-45 max-[760px]:w-full max-[760px]:justify-center"
                type="button"
                onClick={onStartGame}
                disabled={!bothPlayersReady}
              >
                Start game <span aria-hidden="true">→</span>
              </button>
            ) : (
              <p className="m-0 font-serif text-[13px] text-ink-soft italic">The host starts the game.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
