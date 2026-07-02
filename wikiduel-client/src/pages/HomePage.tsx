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
    <main className="mx-auto w-[min(1180px,calc(100%_-_48px))] pb-14 max-[760px]:w-[min(calc(100%_-_28px),620px)]">
      <header className="flex min-h-[92px] items-center justify-between border-b border-ink max-[760px]:min-h-[72px]">
        <Link
          className="bg-transparent p-0 font-display text-[22px] font-black tracking-[-0.08em] text-ink no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark"
          to="/"
          aria-label="WikiDuel home"
        >
          WD<span className="ml-1 text-[13px] text-signal">●</span>
        </Link>
        <ConnectionBadge status={status} />
      </header>

      {notice ? (
        <div className="mt-5 flex items-center justify-between gap-6 border border-ink bg-signal px-[18px] py-3.5 text-ink shadow-[5px_5px_0_#151515]" role="alert">
          <p className="m-0"><strong>Room closed.</strong> {notice}</p>
          <button
            className="size-8 cursor-pointer border border-ink bg-transparent p-0 text-xl leading-none text-ink focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark"
            type="button"
            onClick={clearNotice}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)] items-end gap-12 py-16 motion-safe:animate-arrive max-[760px]:grid-cols-1 max-[760px]:gap-7 max-[760px]:py-[42px]">
        <p className="col-span-full mb-[-30px] text-xs font-black tracking-[0.16em] text-ink-soft uppercase max-[760px]:mb-[-10px]">The shortest path wins</p>
        <h1 className="m-0 font-display text-[clamp(82px,13vw,172px)] leading-[0.74] font-black tracking-[-0.085em] text-ink max-[760px]:text-[clamp(72px,26vw,118px)]">
          WIKI<br />DUEL
        </h1>
        <p className="mb-2 max-w-[340px] font-serif text-[clamp(20px,2.4vw,30px)] leading-[1.2] text-ink">
          Race through Wikipedia. Outsmart your friends. Claim the shortest route.
        </p>
      </section>

      <section
        className="grid grid-cols-2 border border-ink bg-paper shadow-[12px_12px_0_#151515] motion-safe:animate-arrive motion-safe:[animation-delay:80ms] max-[760px]:grid-cols-1 max-[760px]:shadow-[7px_7px_0_#151515]"
        aria-label="Room actions"
      >
        <article className="grid min-h-[330px] grid-cols-[48px_1fr] gap-x-[22px] gap-y-3 border-r border-ink p-[34px] max-[760px]:min-h-[300px] max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-[26px_20px]">
          <span className="font-mono text-[13px] text-ink-soft">01</span>
          <div>
            <p className="mb-3 text-xs font-black tracking-[0.16em] text-ink-soft uppercase">Start fresh</p>
            <h2 className="mb-2.5 font-display text-[clamp(30px,4vw,46px)] tracking-[-0.05em] text-ink">Create a room</h2>
            <p className="m-0 max-w-[310px] leading-[1.55] text-ink-soft">Get a private code and invite your rivals.</p>
          </div>
          <button
            className="col-start-2 flex min-h-[58px] cursor-pointer items-center justify-between self-end border border-ink bg-ink px-5 font-black text-paper transition-[transform,box-shadow] duration-150 hover:not-disabled:-translate-x-[3px] hover:not-disabled:-translate-y-[3px] hover:not-disabled:shadow-[5px_5px_0_#a7ff4a] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            Create room <span aria-hidden="true">→</span>
          </button>
        </article>

        <form className="grid min-h-[330px] grid-cols-[48px_1fr] gap-x-[22px] gap-y-3 p-[34px] max-[760px]:min-h-[300px] max-[760px]:p-[26px_20px]" onSubmit={submitJoin}>
          <span className="font-mono text-[13px] text-ink-soft">02</span>
          <div>
            <p className="mb-3 text-xs font-black tracking-[0.16em] text-ink-soft uppercase">Got a code?</p>
            <h2 className="mb-2.5 font-display text-[clamp(30px,4vw,46px)] tracking-[-0.05em] text-ink">Join a room</h2>
            <p className="m-0 max-w-[310px] leading-[1.55] text-ink-soft">Enter the five-character code from your host.</p>
          </div>
          <label className="col-start-2 mb-[-3px] self-end text-[11px] font-black tracking-[0.12em] text-ink-soft uppercase" htmlFor="room-code">Room code</label>
          <div className="col-start-2 grid grid-cols-[1fr_58px]">
            <input
              className="min-w-0 border border-r-0 border-ink bg-transparent px-[18px] font-mono text-[22px] font-extrabold tracking-[0.22em] text-ink uppercase placeholder:text-[#aaa59a] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark"
              id="room-code"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
              placeholder="ABCDE"
              autoComplete="off"
              spellCheck="false"
            />
            <button
              className="flex min-h-[58px] cursor-pointer items-center justify-center border border-ink bg-ink p-0 text-2xl font-black text-paper transition-[transform,box-shadow] duration-150 hover:not-disabled:-translate-x-[3px] hover:not-disabled:-translate-y-[3px] hover:not-disabled:shadow-[5px_5px_0_#a7ff4a] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-dark disabled:cursor-not-allowed disabled:opacity-45"
              type="submit"
              disabled={!canSubmit || roomCode.length !== 5}
              aria-label="Join room"
            >
              →
            </button>
          </div>
          {error ? <p className="col-start-2 mt-[-2px] text-[13px] font-extrabold text-danger" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}
