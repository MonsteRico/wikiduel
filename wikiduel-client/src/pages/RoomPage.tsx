import { useEffect, useRef } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { ConnectionBadge } from '../components/ConnectionBadge'
import { PlayerRoster } from '../features/rooms/PlayerRoster'
import { useRoom } from '../features/rooms/roomContext'

export function RoomPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams()
  const requestedCodeRef = useRef<string | null>(null)
  const normalizedRoomCode = roomCode?.toUpperCase() ?? ''
  const isValidRoomCode = /^[A-Z2-9]{5}$/.test(normalizedRoomCode)
  const {
    status,
    room,
    error,
    notice,
    clientId,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
  } = useRoom()
  const currentMember = room?.members.find((member) => member.id === clientId)

  useEffect(() => {
    if (
      status !== 'connected'
      || !isValidRoomCode
      || notice
      || room?.code === normalizedRoomCode
      || requestedCodeRef.current === normalizedRoomCode
    ) return

    requestedCodeRef.current = normalizedRoomCode
    joinRoom(normalizedRoomCode)
  }, [isValidRoomCode, joinRoom, normalizedRoomCode, notice, room?.code, status])

  useEffect(() => {
    if (notice) navigate('/', { replace: true })
  }, [navigate, notice])

  if (!isValidRoomCode) return <Navigate to="/" replace />

  const handleLeave = () => {
    leaveRoom()
    navigate('/')
  }

  return (
    <main className="room-page">
      <header className="site-header">
        <button className="brand brand--button" type="button" onClick={handleLeave} aria-label="Leave room and return home">
          WD<span>●</span>
        </button>
        <button className="leave-button" type="button" onClick={handleLeave}>Leave room</button>
      </header>

      <section className="room-heading">
        <div>
          <p className="kicker">Lobby open</p>
          <h1>ROOM<br />{normalizedRoomCode}</h1>
        </div>
        <div className="code-ticket" aria-label={`Room code ${normalizedRoomCode}`}>
          <p>Invite code</p>
          <strong>{normalizedRoomCode}</strong>
          <span>Share this with your rivals</span>
        </div>
      </section>

      <PlayerRoster
        room={room?.code === normalizedRoomCode ? room : null}
        currentMember={currentMember}
        error={error}
        onSetReady={setReady}
        onStartGame={startGame}
      />

      <footer className="room-footer">
        <ConnectionBadge status={status} />
        <p>The duel begins when everyone is ready.</p>
      </footer>
    </main>
  )
}
