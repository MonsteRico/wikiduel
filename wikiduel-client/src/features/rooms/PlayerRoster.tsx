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
    <section className="roster" aria-labelledby="roster-heading">
      <div className="roster-header">
        <div>
          <p className="action-label">Match lobby</p>
          <h2 id="roster-heading">Players</h2>
        </div>
        <span>{room?.members.length ?? 0} joined</span>
      </div>

      {error ? <p className="room-message room-message--error" role="alert">{error}</p> : null}
      {!room && !error ? <p className="room-message">Joining room...</p> : null}

      <ul className="player-list">
        {room?.members.map((member, index) => (
          <li key={member.id}>
            <div className="player-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="player-avatar" aria-hidden="true">{member.name.charAt(0)}</div>
            <div className="player-name">
              <strong>{member.name}</strong>
              <span>{member.role === 'host' ? 'Room host' : 'Challenger'}</span>
            </div>
            <div className="player-state">
              <div className={`presence ${member.connected ? 'presence--online' : ''}`}>
                <span aria-hidden="true" />
                {member.connected ? 'Connected' : 'Offline'}
              </div>
              <div className={`readiness ${member.ready ? 'readiness--ready' : ''}`}>
                {member.ready ? 'Ready' : 'Not ready'}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {currentMember ? (
        <div className="lobby-controls">
          <div>
            <p className="action-label">Your status</p>
            <strong>{bothPlayersReady ? 'Both players are ready.' : 'Ready when you are.'}</strong>
          </div>
          <div className="lobby-buttons">
            <button
              className="ready-button"
              type="button"
              onClick={() => onSetReady(!currentMember.ready)}
            >
              {currentMember.ready ? 'Cancel ready' : "I'm ready"}
            </button>
            {isHost ? (
              <button
                className="start-button"
                type="button"
                onClick={onStartGame}
                disabled={!bothPlayersReady}
              >
                Start game <span aria-hidden="true">→</span>
              </button>
            ) : (
              <p className="host-waiting">The host starts the game.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
