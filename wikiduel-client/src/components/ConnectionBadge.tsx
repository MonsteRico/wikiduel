import type { ConnectionStatus } from '../websocket/WebSocketTransport'
import { StatusIndicator, type StatusTone } from './ui/StatusIndicator'

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const tone = ({
    connecting: 'warning',
    connected: 'success',
    disconnected: 'danger',
  } satisfies Record<ConnectionStatus, StatusTone>)[status]

  return (
    <div role="status"><StatusIndicator tone={tone}>Server {status}</StatusIndicator></div>
  )
}
