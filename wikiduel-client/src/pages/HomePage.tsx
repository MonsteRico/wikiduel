import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ConnectionBadge } from '../components/ConnectionBadge'
import { AppShell } from '../components/ui/AppShell'
import { ArrowRightIcon, PlayersIcon } from '../components/ui/Icons'
import { Panel } from '../components/ui/Panel'
import { useRoom } from '../features/rooms/roomContext'

export function HomePage() {
  const navigate = useNavigate()
  const { status, room, error, notice, createRoom, joinRoom, clearNotice } = useRoom()
  const [roomCode, setRoomCode] = useState('')
  const [awaitingRoom, setAwaitingRoom] = useState(false)
  const canSubmit = status === 'connected' && !awaitingRoom

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
    <AppShell headerAction={<ConnectionBadge status={status} />}>
      {notice ? (
        <div className="ds-inset mb-5 flex items-center justify-between gap-5 border-danger/40 bg-danger/10 px-4 py-3 text-sm text-ink motion-safe:animate-arrive" role="alert">
          <p className="m-0"><strong>Lobby closed.</strong> {notice}</p>
          <button className="ds-focus cursor-pointer rounded-sm border-0 bg-transparent p-1 text-xl leading-none text-ink-soft hover:text-ink" type="button" onClick={clearNotice} aria-label="Dismiss message">×</button>
        </div>
      ) : null}

      <section className="grid place-items-center py-4">
        <div className="w-full max-w-[760px] motion-safe:animate-arrive">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-host text-white shadow-[0_0_0_7px_rgb(95_159_248/8%)]" aria-hidden="true">
              <PlayersIcon className="size-6" />
            </div>
            <h1 className="m-0 font-display text-[clamp(2.1rem,5vw,3.25rem)] leading-[0.98] font-black tracking-[0.015em] text-ink uppercase">
              Race Wikipedia.<br /><span className="text-host">Find the shortest path.</span>
            </h1>
            <p className="mx-auto mt-3.5 max-w-[510px] text-sm leading-5 text-ink-soft">
              Challenge a friend to a head-to-head race through Wikipedia links.
            </p>
          </div>

          <Panel className="overflow-hidden" aria-labelledby="duel-actions-heading">
            <div className="border-b border-line px-6 py-5 max-[640px]:px-5">
              <h2 className="m-0 font-display text-xl font-extrabold tracking-[0.015em] text-ink" id="duel-actions-heading">Create or join a duel</h2>
              <p className="mt-1.5 mb-0 text-sm text-ink-soft">Create a private lobby, or enter the code from your host.</p>
            </div>

            <div className="grid grid-cols-2 max-[640px]:grid-cols-1">
              <article className="flex min-h-[210px] flex-col border-r border-line p-5 max-[640px]:min-h-0 max-[640px]:border-r-0 max-[640px]:border-b">
                <span className="ds-label text-host">Host a duel</span>
                <h3 className="mt-3 mb-2 font-display text-2xl font-extrabold text-ink">Start a new lobby</h3>
                <p className="m-0 max-w-[280px] text-sm leading-[1.55] text-ink-soft">Get a private five-character code to share with your opponent.</p>
                <button
                  className="ds-focus mt-auto flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-host-strong bg-host-strong px-4 font-display text-xs font-extrabold tracking-[0.04em] text-white uppercase transition-[background-color,transform] hover:not-disabled:-translate-y-px hover:not-disabled:bg-host disabled:cursor-not-allowed disabled:opacity-40 max-[640px]:mt-6"
                  type="button"
                  onClick={handleCreate}
                  disabled={!canSubmit}
                >
                  {awaitingRoom ? 'Creating lobby…' : 'Create lobby'} <ArrowRightIcon />
                </button>
              </article>

              <form className="flex min-h-[210px] flex-col p-5 max-[640px]:min-h-0" onSubmit={submitJoin}>
                <label className="ds-label" htmlFor="room-code">Lobby code</label>
                <input
                  className="ds-focus mt-3 h-12 w-full rounded-control border border-line bg-canvas-deep/35 px-4 font-mono text-xl font-bold tracking-[0.22em] text-host uppercase placeholder:text-ink-faint/60"
                  id="room-code"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
                  placeholder="7G8KZ"
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby={error ? 'room-code-error' : undefined}
                />
                <p className="mt-3 mb-0 text-sm leading-[1.55] text-ink-soft">Enter the code exactly as it appears in the host’s lobby.</p>
                {error ? <p className="mt-2 mb-0 text-xs font-semibold text-danger" id="room-code-error" role="alert">{error}</p> : null}
                <button
                  className="ds-focus mt-auto flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface-raised px-4 font-display text-xs font-extrabold tracking-[0.04em] text-ink uppercase transition-[border-color,background-color,transform] hover:not-disabled:-translate-y-px hover:not-disabled:border-host hover:not-disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-40 max-[640px]:mt-6"
                  type="submit"
                  disabled={!canSubmit || roomCode.length !== 5}
                >
                  Join lobby <ArrowRightIcon />
                </button>
              </form>
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  )
}
