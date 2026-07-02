import { useEffect, useState, type FormEvent } from 'react'

import './App.css'
import type { ConnectionStatus, Room } from './roomTypes'
import { useRoomSocket } from './useRoomSocket'

const roomCodeFromPath = () => {
  const match = window.location.pathname.match(/^\/room\/([A-Z2-9]{5})$/i)
  return match?.[1]?.toUpperCase() ?? null
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div className={`connection-badge connection-badge--${status}`} role="status">
      <span aria-hidden="true" />
      Server {status}
    </div>
  )
}

type HomePageProps = {
  status: ConnectionStatus
  error: string | null
  onCreateRoom: () => void
  onJoinRoom: (roomCode: string) => void
}

function HomePage({ status, error, onCreateRoom, onJoinRoom }: HomePageProps) {
  const [roomCode, setRoomCode] = useState('')
  const canSubmit = status === 'connected'

  const submitJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (roomCode.length === 5) onJoinRoom(roomCode)
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="WikiDuel home">WD<span>●</span></a>
        <ConnectionBadge status={status} />
      </header>

      <section className="home-hero">
        <p className="kicker">The shortest path wins</p>
        <h1>WIKI<br />DUEL</h1>
        <p className="intro">Race through Wikipedia. Outsmart your friends. Claim the shortest route.</p>
      </section>

      <section className="room-actions" aria-label="Room actions">
        <article className="action-card action-card--create">
          <span className="action-number">01</span>
          <div>
            <p className="action-label">Start fresh</p>
            <h2>Create a room</h2>
            <p>Get a private code and invite your rivals.</p>
          </div>
          <button className="primary-button" type="button" onClick={onCreateRoom} disabled={!canSubmit}>
            Create room <span aria-hidden="true">→</span>
          </button>
        </article>

        <form className="action-card action-card--join" onSubmit={submitJoin}>
          <span className="action-number">02</span>
          <div>
            <p className="action-label">Got a code?</p>
            <h2>Join a room</h2>
            <p>Enter the five-character code from your host.</p>
          </div>
          <label htmlFor="room-code">Room code</label>
          <div className="code-entry">
            <input
              id="room-code"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
              placeholder="ABCDE"
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" disabled={!canSubmit || roomCode.length !== 5} aria-label="Join room">
              →
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}

type RoomPageProps = {
  status: ConnectionStatus
  room: Room | null
  roomCode: string
  error: string | null
  onLeave: () => void
}

function RoomPage({ status, room, roomCode, error, onLeave }: RoomPageProps) {
  return (
    <main className="room-page">
      <header className="site-header">
        <button className="brand brand--button" type="button" onClick={onLeave} aria-label="Leave room and return home">
          WD<span>●</span>
        </button>
        <button className="leave-button" type="button" onClick={onLeave}>Leave room</button>
      </header>

      <section className="room-heading">
        <div>
          <p className="kicker">Lobby open</p>
          <h1>ROOM<br />{roomCode}</h1>
        </div>
        <div className="code-ticket" aria-label={`Room code ${roomCode}`}>
          <p>Invite code</p>
          <strong>{roomCode}</strong>
          <span>Share this with your rivals</span>
        </div>
      </section>

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
                <span>Waiting for the duel to begin</span>
              </div>
              <div className={`presence ${member.connected ? 'presence--online' : ''}`}>
                <span aria-hidden="true" />
                {member.connected ? 'Connected' : 'Offline'}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="room-footer">
        <ConnectionBadge status={status} />
        <p>The duel begins when everyone is ready.</p>
      </footer>
    </main>
  )
}

function App() {
  const [activeRoomCode, setActiveRoomCode] = useState(roomCodeFromPath)
  const { status, room, error, createRoom, joinRoom, leaveRoom } = useRoomSocket(activeRoomCode)

  useEffect(() => {
    if (!room || room.code === activeRoomCode) return

    window.history.pushState({}, '', `/room/${room.code}`)
    setActiveRoomCode(room.code)
  }, [activeRoomCode, room])

  useEffect(() => {
    const handlePopState = () => {
      const nextRoomCode = roomCodeFromPath()
      setActiveRoomCode(nextRoomCode)
      if (!nextRoomCode) leaveRoom()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [leaveRoom])

  const handleLeave = () => {
    leaveRoom()
    window.history.pushState({}, '', '/')
    setActiveRoomCode(null)
  }

  if (activeRoomCode) {
    return <RoomPage status={status} room={room} roomCode={activeRoomCode} error={error} onLeave={handleLeave} />
  }

  return <HomePage status={status} error={error} onCreateRoom={createRoom} onJoinRoom={joinRoom} />
}

export default App
