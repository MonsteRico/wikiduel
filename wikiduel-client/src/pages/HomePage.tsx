import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { ConnectionBadge } from '../components/ConnectionBadge'
import { useRoom } from '../features/rooms/roomContext'

export function HomePage() {
  const navigate = useNavigate()
  const {
    status,
    room,
    error,
    notice,
    createRoom,
    joinRoom,
    clearNotice,
  } = useRoom()
  const [roomCode, setRoomCode] = useState('')
  const [awaitingRoom, setAwaitingRoom] = useState(false)
  const canSubmit = status === 'connected'

  useEffect(() => {
    if (awaitingRoom && room) navigate(`/room/${room.code}`)
  }, [awaitingRoom, navigate, room])

  useEffect(() => {
    if (error) setAwaitingRoom(false)
  }, [error])

  const handleCreate = () => {
    setAwaitingRoom(true)
    createRoom()
  }

  const submitJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (roomCode.length !== 5) return

    setAwaitingRoom(true)
    joinRoom(roomCode)
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="WikiDuel home">WD<span>●</span></Link>
        <ConnectionBadge status={status} />
      </header>

      {notice ? (
        <div className="notice" role="alert">
          <p><strong>Room closed.</strong> {notice}</p>
          <button type="button" onClick={clearNotice} aria-label="Dismiss message">×</button>
        </div>
      ) : null}

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
          <button className="primary-button" type="button" onClick={handleCreate} disabled={!canSubmit}>
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
            <button type="submit" disabled={!canSubmit || roomCode.length !== 5} aria-label="Join room">→</button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}
