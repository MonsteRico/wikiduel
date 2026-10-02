import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useBlocker } from 'react-router'
import { AppShell } from '../../components/ui/AppShell'
import { Button } from '../../components/ui/Button'
import { useLobby } from './lobbyContext'

// Mounted once per Duel so a confirmation can never carry into a Rematch.
export function DuelDeparture({ duelId, children }: PropsWithChildren<{ duelId: string }>) {
  const { leaveDuel, leaving, status } = useLobby()
  const [explicit, setExplicit] = useState(false)
  const blocker = useBlocker(({ nextLocation }) => nextLocation.pathname !== `/duel/${duelId}`)
  const confirming = explicit || blocker.state === 'blocked'
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (confirming) dialog.current?.showModal()
    else dialog.current?.close()
  }, [confirming])

  useEffect(() => {
    const confirmUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', confirmUnload)
    return () => window.removeEventListener('beforeunload', confirmUnload)
  }, [])

  const cancel = () => {
    if (leaving) return
    setExplicit(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  return <AppShell headerAction={<Button variant="ghost" disabled={leaving} onClick={() => setExplicit(true)}>Leave Duel</Button>}>
    <dialog ref={dialog} aria-label="Leave Duel?" aria-describedby="leave-duel-description"
      onCancel={(event) => { event.preventDefault(); cancel() }}
      className="m-auto max-w-lg rounded-control border border-line bg-surface p-6 text-ink backdrop:bg-black/60">
      <h2 className="font-display text-xl">Leave Duel?</h2>
      <p id="leave-duel-description">Leaving closes the Lobby for both players. An unfinished Duel ends by Forfeit.</p>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" disabled={leaving} autoFocus onClick={cancel}>Keep playing</Button>
        <Button variant="danger" disabled={leaving || status !== 'connected'} onClick={() => leaveDuel(duelId)}>Confirm Leave Duel</Button>
      </div>
      {leaving && <p role="status">Leaving Duel...</p>}
    </dialog>
    <fieldset disabled={leaving} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
  </AppShell>
}
