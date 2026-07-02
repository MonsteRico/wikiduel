import type { ConnectionStatus } from '../features/rooms/types'

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div className={`connection-badge connection-badge--${status}`} role="status">
      <span aria-hidden="true" />
      Server {status}
    </div>
  )
}
