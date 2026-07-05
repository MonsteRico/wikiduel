import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { Button } from '../components/ui/Button'
import { AppShell } from '../components/ui/AppShell'
import { CopyIcon } from '../components/ui/Icons'
import { Panel } from '../components/ui/Panel'
import { PlayerRoster } from '../features/lobby/PlayerRoster'
import { useLobby } from '../features/lobby/lobbyContext'

export function LobbyPage() {
  const navigate = useNavigate()
  const { lobbyCode } = useParams()
  const requestedCodeRef = useRef<string | null>(null)
  const [copied, setCopied] = useState(false)
  const normalizedLobbyCode = lobbyCode?.toUpperCase() ?? ''
  const isValidLobbyCode = /^[A-Z2-9]{5}$/.test(normalizedLobbyCode)
  const { status, lobby, error, notice, clientId, joinLobby, leaveLobby, setReady, startGame } = useLobby()
  const currentMember = lobby?.members.find((member) => member.id === clientId)

  useEffect(() => {
    if (
      status !== 'connected'
      || !isValidLobbyCode
      || notice
      || lobby?.code === normalizedLobbyCode
      || requestedCodeRef.current === normalizedLobbyCode
    ) return

    requestedCodeRef.current = normalizedLobbyCode
    joinLobby(normalizedLobbyCode)
  }, [isValidLobbyCode, joinLobby, lobby?.code, normalizedLobbyCode, notice, status])

  useEffect(() => {
    if (notice) navigate('/', { replace: true })
  }, [navigate, notice])

  if (!isValidLobbyCode) return <Navigate to="/" replace />

  const handleLeave = () => {
    leaveLobby()
    navigate('/')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(normalizedLobbyCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <AppShell headerAction={<Button variant="ghost" onClick={handleLeave}>Leave lobby</Button>}>
      <section className="grid min-h-[calc(100vh-120px)] place-items-center py-8">
        <Panel as="div" className="w-full max-w-[680px] overflow-hidden motion-safe:animate-arrive">
          <header className="flex items-start justify-between gap-6 border-b border-line px-6 py-5 max-[560px]:flex-col max-[560px]:px-5">
            <div>
              <p className="ds-label mb-2 text-host">Lobby</p>
              <h1 className="m-0 font-display text-2xl font-extrabold tracking-[0.01em] text-ink">Waiting for the duel</h1>
              <p className="mt-1.5 mb-0 text-sm text-ink-soft">Both players must be connected and ready.</p>
            </div>
            <div className="ds-inset min-w-[210px] p-3 max-[560px]:w-full">
              <span className="ds-label block text-[10px]">Lobby code</span>
              <div className="mt-1 flex items-center justify-between gap-3">
                <strong className="font-mono text-[22px] tracking-[0.12em] text-host">{normalizedLobbyCode}</strong>
                <button className="ds-focus grid size-9 cursor-pointer place-items-center rounded-control border border-line bg-surface-raised text-ink-soft hover:border-host hover:text-ink" type="button" onClick={handleCopy} aria-label="Copy lobby code">
                  <CopyIcon />
                </button>
              </div>
              <span className="mt-1 block min-h-4 text-[10px] text-success" role="status">{copied ? 'Copied to clipboard' : 'Share with your opponent'}</span>
            </div>
          </header>

          <PlayerRoster
            lobby={lobby?.code === normalizedLobbyCode ? lobby : null}
            currentMember={currentMember}
            error={error}
            onSetReady={setReady}
            onStartGame={startGame}
          />
        </Panel>
      </section>
    </AppShell>
  )
}
