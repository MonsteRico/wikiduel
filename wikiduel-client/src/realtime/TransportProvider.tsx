import { useEffect, useState, type PropsWithChildren } from 'react'

import type { ClientMessage, ServerMessage } from './messages'
import { TransportContext } from './transportContext'
import { WebSocketTransport } from './WebSocketTransport'

const websocketUrl =
  import.meta.env.VITE_WS_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3000/ws`

export function TransportProvider({ children }: PropsWithChildren) {
  const [transport] = useState(
    () => new WebSocketTransport<ClientMessage, ServerMessage>(websocketUrl),
  )

  useEffect(() => {
    transport.connect()
    return () => transport.close()
  }, [transport])

  return <TransportContext value={transport}>{children}</TransportContext>
}
