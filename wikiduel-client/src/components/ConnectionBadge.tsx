import type { ConnectionStatus } from '../features/rooms/types'

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const dotClass = {
    connecting: 'bg-warning',
    connected: 'bg-signal shadow-[0_0_0_4px_rgb(167_255_74/20%)]',
    disconnected: 'bg-danger',
  }[status]

  return (
    <div
      className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-ink-soft uppercase"
      role="status"
    >
      <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
      Server {status}
    </div>
  )
}
