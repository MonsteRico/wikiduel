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
    <main className="mx-auto w-[min(1180px,calc(100%_-_48px))] pb-14 max-[760px]:w-[min(calc(100%_-_28px),620px)]">
      <header className="flex min-h-[92px] items-center justify-between border-b border-ink max-[760px]:min-h-[72px]">
        <button
          className="w-auto cursor-pointer border-0 bg-transparent p-0 font-display text-[22px] font-black tracking-[-0.08em] text-ink focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark"
          type="button"
          onClick={handleLeave}
          aria-label="Leave room and return home"
        >
          WD<span className="ml-1 text-[13px] text-signal">●</span>
        </button>
        <button
          className="w-auto cursor-pointer border border-ink bg-transparent px-3.5 py-[9px] text-xs font-black tracking-[0.06em] text-ink uppercase focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark"
          type="button"
          onClick={handleLeave}
        >
          Leave room
        </button>
      </header>

      <section className="grid grid-cols-[1fr_auto] items-end gap-10 py-[54px] pt-16 motion-safe:animate-arrive max-[760px]:grid-cols-1 max-[760px]:py-[42px] max-[760px]:pt-12">
        <div>
          <p className="mb-6 text-xs font-black tracking-[0.16em] text-ink-soft uppercase">Lobby open</p>
          <h1 className="m-0 font-display text-[clamp(66px,10vw,130px)] leading-[0.8] font-black tracking-[-0.085em] text-ink">
            ROOM<br />{normalizedRoomCode}
          </h1>
        </div>
        <div
          className="relative min-w-[300px] border border-ink bg-signal px-[34px] py-[30px] shadow-[8px_8px_0_#151515] before:absolute before:top-1/2 before:left-[-10px] before:size-[18px] before:rounded-full before:border before:border-ink before:bg-canvas before:content-[''] after:absolute after:top-1/2 after:right-[-10px] after:size-[18px] after:rounded-full after:border after:border-ink after:bg-canvas after:content-[''] max-[760px]:w-[calc(100%_-_8px)] max-[760px]:min-w-0"
          aria-label={`Room code ${normalizedRoomCode}`}
        >
          <p className="m-0 text-[10px] font-black tracking-[0.14em] uppercase">Invite code</p>
          <strong className="my-2.5 block font-mono text-[42px] tracking-[0.12em]">{normalizedRoomCode}</strong>
          <span className="block text-[10px] font-black tracking-[0.14em] uppercase">Share this with your rivals</span>
        </div>
      </section>

      <PlayerRoster
        room={room?.code === normalizedRoomCode ? room : null}
        currentMember={currentMember}
        error={error}
        onSetReady={setReady}
        onStartGame={startGame}
      />

      <footer className="flex items-center justify-between gap-[18px] pt-5 max-[760px]:items-start">
        <ConnectionBadge status={status} />
        <p className="m-0 font-serif text-ink-soft italic max-[760px]:text-right">The duel begins when everyone is ready.</p>
      </footer>
    </main>
  )
}
